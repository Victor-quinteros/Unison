// 01. Supabase client configuration and in-memory auth state
const supabaseConfig = window.UNISON_SUPABASE_CONFIG || {};
const supabaseUrl = String(supabaseConfig.url || "").replace(/\/+$/, "");
const supabasePublishableKey = String(supabaseConfig.publishableKey || "");
let supabaseSession = null;
let refreshRequest = null;
const sessionStorageKey = "unison.auth.session";
const privateMediaCache = new Map();

function isSupabaseConfigured() {
	return Boolean(supabaseUrl && supabasePublishableKey);
}

function setSession(session) {
	if (!session?.access_token) {
		supabaseSession = null;
		try { window.sessionStorage.removeItem(sessionStorageKey); } catch { /* Storage may be unavailable in private browsing. */ }
		return null;
	}

	supabaseSession = {
		...session,
		expires_at: session.expires_at || Math.floor(Date.now() / 1000) + (session.expires_in || 3600)
	};
	try { window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(supabaseSession)); } catch { /* Keep the session in memory when storage is unavailable. */ }
	return supabaseSession;
}

function restoreSession() {
	try {
		const savedSession = JSON.parse(window.sessionStorage.getItem(sessionStorageKey) || "null");
		if (savedSession?.access_token && savedSession?.user) supabaseSession = savedSession;
	} catch {
		try { window.sessionStorage.removeItem(sessionStorageKey); } catch { /* Storage may be unavailable. */ }
	}
}

restoreSession();

async function readResponse(response) {
	const text = await response.text();
	let data = null;
	if (text) {
		try {
			data = JSON.parse(text);
		} catch {
			data = { message: text };
		}
	}
	if (!response.ok) {
		throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `Supabase request failed (${response.status}).`);
	}
	return data;
}

function configuredUrl(path) {
	if (!isSupabaseConfigured()) {
		throw new Error("Add the Supabase project URL and publishable key to supabase-config.js first.");
	}
	return new URL(path.replace(/^\/+/, ""), `${supabaseUrl}/`);
}

async function authRequest(path, body, accessToken = "") {
	const headers = new Headers({
		apikey: supabasePublishableKey,
		"Content-Type": "application/json"
	});
	if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
	const response = await fetch(configuredUrl(`auth/v1/${path}`), {
		method: "POST",
		headers,
		body: JSON.stringify(body || {})
	});
	return readResponse(response);
}

async function refreshSession() {
	if (!supabaseSession?.refresh_token) throw new Error("Sign in to continue.");
	if (!refreshRequest) {
		refreshRequest = authRequest("token?grant_type=refresh_token", {
			refresh_token: supabaseSession.refresh_token
		}).then(setSession).finally(() => {
			refreshRequest = null;
		});
	}
	return refreshRequest;
}

async function requireSession() {
	if (!supabaseSession) throw new Error("Sign in to use this feature.");
	if (supabaseSession.expires_at - Math.floor(Date.now() / 1000) < 60) await refreshSession();
	return supabaseSession;
}

async function supabaseRequest(path, options = {}) {
	if (options.auth) await requireSession();
	const headers = new Headers(options.headers || {});
	headers.set("apikey", supabasePublishableKey);
	if (options.auth) headers.set("Authorization", `Bearer ${supabaseSession.access_token}`);
	else headers.delete("Authorization");
	if (options.body !== undefined) headers.set("Content-Type", "application/json");
	const response = await fetch(configuredUrl(`rest/v1/${path}`), {
		method: options.method || "GET",
		headers,
		body: options.body === undefined ? undefined : JSON.stringify(options.body)
	});
	return readResponse(response);
}

function storageObjectPath(bucket, value) {
	const source = String(value || "");
	const marker = `/object/public/${bucket}/`;
	const markerIndex = source.indexOf(marker);
	if (markerIndex >= 0) return decodeURIComponent(source.slice(markerIndex + marker.length).split("?")[0]);
	return source.startsWith("http") ? "" : source;
}

async function privateMediaUrl(path) {
	if (!path) return "";
	if (privateMediaCache.has(path)) return privateMediaCache.get(path);
	const mediaRequest = (async () => {
		const session = supabaseSession ? await requireSession() : null;
		const headers = new Headers({ apikey: supabasePublishableKey });
		if (session) headers.set("Authorization", `Bearer ${session.access_token}`);
		const response = await fetch(configuredUrl(`storage/v1/object/authenticated/post-media/${path}`), { headers });
		if (!response.ok) await readResponse(response);
		return URL.createObjectURL(await response.blob());
	})();
	privateMediaCache.set(path, mediaRequest);
	try {
		return await mediaRequest;
	} catch (error) {
		privateMediaCache.delete(path);
		throw error;
	}
}

function publicProfileMediaUrl(value) {
	const source = String(value || "").trim();
	if (!source) return "";
	let path = storageObjectPath("profile-media", source);
	if (!path && !source.startsWith("http")) {
		const rawPath = source.replace(/^\/+/, "");
		if (rawPath.startsWith("profile-media/")) path = rawPath.slice("profile-media/".length);
	}
	if (!path) return source.startsWith("http") && source.includes("/profile-media/") ? source : "";
	const encodedPath = path.split("/").map(encodeURIComponent).join("/");
	return `${supabaseUrl}/storage/v1/object/public/profile-media/${encodedPath}`;
}

async function profileAvatarUrl(value) {
	const source = String(value || "").trim();
	if (!source) return "";
	const profileMediaUrl = publicProfileMediaUrl(source);
	if (profileMediaUrl) return profileMediaUrl;
	const oldPostMediaPath = storageObjectPath("post-media", source);
	return oldPostMediaPath ? privateMediaUrl(oldPostMediaPath) : source;
}

async function mapPost(row) {
	const profile = row.profiles || {};
	const likes = row.post_likes || [];
	const comments = row.post_comments || [];
	const savedPosts = row.saved_posts || [];
	const imagePath = storageObjectPath("post-media", row.image_path);
	const [image, avatar] = await Promise.all([
		imagePath ? privateMediaUrl(imagePath).catch(() => "") : Promise.resolve(""),
		profileAvatarUrl(profile.avatar_url).catch(() => "")
	]);
	return {
		id: row.id,
		userId: row.user_id,
		visibility: row.visibility || "public",
		avatarBorder: profile.avatar_border || "none",
		profileSticker: profile.profile_sticker || "none",
		author: profile.display_name || "Unison member",
		handle: profile.handle ? `@${profile.handle}` : "@member",
		time: new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-Math.max(1, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 3600000)), "hour"),
		avatar,
		text: row.body,
		search: row.body,
		image,
		imageAlt: "",
		likes: likes.length,
		replies: comments.length,
		liked: Boolean(supabaseSession && likes.some((like) => like.user_id === supabaseSession.user.id)),
		saved: Boolean(supabaseSession && savedPosts.some((saved) => saved.user_id === supabaseSession.user.id)),
		local: row.scope === "townsquare",
		community: row.scope === "community",
		localType: row.scope === "townsquare" ? "Neighborhood post" : row.scope === "community" ? "Community post" : ""
	};
}

function postSelect() {
	const fields = [
		"id", "user_id", "body", "scope", "visibility", "image_path", "created_at",
		"profiles!posts_user_id_fkey(display_name,handle,avatar_url,avatar_border,profile_sticker)"
	];
	if (supabaseSession) fields.push("post_likes(user_id)", "post_comments(id)", "saved_posts(user_id)");
	return fields.join(",");
}

// 02. Supabase Auth helpers. Sessions persist for this browser tab and survive page reloads.
window.UnisonAuth = Object.freeze({
	isConfigured: isSupabaseConfigured,
	getUser() {
		return supabaseSession?.user || null;
	},
	async signUp({ email, password, handle, displayName }) {
		const result = await authRequest("signup", {
			email: String(email || "").trim(),
			password,
			data: { handle, display_name: displayName }
		});
		setSession(result);
		return { user: result.user || null, needsEmailConfirmation: !result.access_token };
	},
	async signIn({ email, password }) {
		const result = await authRequest("token?grant_type=password", {
			email: String(email || "").trim(),
			password
		});
		setSession(result);
		return result.user;
	},
	async signOut() {
		if (!supabaseSession) return;
		try {
			await authRequest("logout", {}, supabaseSession.access_token);
		} finally {
			setSession(null);
		}
	}
});

// 03. Supabase data and storage endpoints
window.UnisonApi = Object.freeze({
	isConfigured: isSupabaseConfigured,
	async listPosts({ scope = "home", search = "", profileUserId = "" } = {}) {
		const session = supabaseSession ? await requireSession() : null;
		if (!session && scope !== "community" && !(scope === "profile" && profileUserId)) {
			throw new Error("Sign in to view these posts.");
		}
		const params = new URLSearchParams({ select: postSelect(), order: "created_at.desc" });
		if (scope === "townsquare") params.set("scope", "eq.townsquare");
		if (scope === "community") params.set("scope", "eq.community");
		if (scope === "home") params.set("scope", "in.(home,townsquare,community)");
		if (profileUserId) params.set("user_id", `eq.${profileUserId}`);
		if (scope === "mine") {
			params.set("user_id", `eq.${session.user.id}`);
		}
		if (scope === "following" || scope === "saved") {
			if (scope === "following") {
				const follows = await supabaseRequest(`follows?select=followed_id&follower_id=eq.${session.user.id}`, { auth: true });
				if (!follows.length) return [];
				params.set("user_id", `in.(${follows.map((follow) => follow.followed_id).join(",")})`);
			} else {
				const saved = await supabaseRequest(`saved_posts?select=post_id&user_id=eq.${session.user.id}`, { auth: true });
				if (!saved.length) return [];
				params.set("id", `in.(${saved.map((item) => item.post_id).join(",")})`);
			}
		}
		const safeSearch = String(search).replace(/[(),%_*]/g, " ").trim();
		if (safeSearch) params.set("body", `ilike.*${safeSearch}*`);
		const rows = await supabaseRequest(`posts?${params}`, { auth: Boolean(session) });
		return Promise.all(rows.map(mapPost));
	},
	async createPost({ text, scope = "home", visibility = "public", imageFile = null }) {
		const session = await requireSession();
		const body = String(text || "").trim();
		if (!body && !imageFile) throw new TypeError("Add text or a photo before posting.");
		let imagePath = null;
		if (imageFile) imagePath = await this.uploadPostImage(imageFile);
		const params = new URLSearchParams({ select: postSelect() });
		const rows = await supabaseRequest(`posts?${params}`, {
			method: "POST",
			auth: true,
			headers: { Prefer: "return=representation" },
			body: { user_id: session.user.id, body: body || "", scope, visibility, image_path: imagePath }
		});
		return mapPost(rows[0]);
	},
	async deletePost(postId) {
		const session = await requireSession();
		const params = new URLSearchParams({ id: `eq.${postId}`, user_id: `eq.${session.user.id}`, select: "id,image_path" });
		const rows = await supabaseRequest(`posts?${params}`, {
			method: "DELETE",
			auth: true,
			headers: { Prefer: "return=representation" }
		});
		if (!rows.length) throw new Error("This post could not be deleted. Refresh the feed and try again.");
		if (rows[0].image_path) {
			const path = rows[0].image_path.split("/").map(encodeURIComponent).join("/");
			try {
				const response = await fetch(configuredUrl(`storage/v1/object/post-media/${path}`), {
					method: "DELETE",
					headers: { apikey: supabasePublishableKey, Authorization: `Bearer ${session.access_token}` }
				});
				await readResponse(response);
			} catch { /* The post is already deleted; a storage cleanup failure should not undo that. */ }
		}
		return true;
	},
	async likePost(postId, shouldLike) {
		const session = await requireSession();
		const params = new URLSearchParams({ post_id: `eq.${postId}`, user_id: `eq.${session.user.id}` });
		if (shouldLike) {
			params.set("on_conflict", "post_id,user_id");
			return supabaseRequest(`post_likes?${params}`, {
				method: "POST", auth: true,
				headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
				body: { post_id: postId, user_id: session.user.id }
			});
		}
		return supabaseRequest(`post_likes?${params}`, { method: "DELETE", auth: true });
	},
	async savePost(postId, shouldSave) {
		const session = await requireSession();
		const params = new URLSearchParams({ post_id: `eq.${postId}`, user_id: `eq.${session.user.id}` });
		if (shouldSave) {
			params.set("on_conflict", "post_id,user_id");
			return supabaseRequest(`saved_posts?${params}`, {
				method: "POST", auth: true,
				headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
				body: { post_id: postId, user_id: session.user.id }
			});
		}
		return supabaseRequest(`saved_posts?${params}`, { method: "DELETE", auth: true });
	},
	async listComments(postId) {
		const params = new URLSearchParams({
			select: "id,user_id,body,created_at,profiles!post_comments_user_id_fkey(display_name,handle)",
			post_id: `eq.${postId}`,
			order: "created_at.asc"
		});
		return supabaseRequest(`post_comments?${params}`, { auth: true });
	},
	async deleteComment(commentId) {
		await requireSession();
		const params = new URLSearchParams({ id: `eq.${commentId}`, select: "id" });
		const rows = await supabaseRequest(`post_comments?${params}`, {
			method: "DELETE",
			auth: true,
			headers: { Prefer: "return=representation" }
		});
		if (!rows.length) throw new Error("You can only delete your comment or a comment on your own post.");
		return true;
	},
	async listPeople() {
		await requireSession();
		const params = new URLSearchParams({
			select: "id,handle,display_name,avatar_url,bio,avatar_border,profile_sticker",
			order: "created_at.desc",
			limit: "8"
		});
		if (supabaseSession?.user?.id) params.set("id", `neq.${supabaseSession.user.id}`);
		const rows = await supabaseRequest(`profiles?${params}`, { auth: true });
		return Promise.all(rows.map(async (profile) => ({ ...profile, avatar_url: await profileAvatarUrl(profile.avatar_url).catch(() => "") })));
	},
	async searchPeople(query) {
		await requireSession();
		const safeQuery = String(query || "").replace(/[(),%_*]/g, " ").trim();
		if (!safeQuery) return [];
		const params = new URLSearchParams({
			select: "id,handle,display_name,avatar_url,bio,avatar_border,profile_sticker",
			order: "display_name.asc",
			limit: "12",
			or: `(display_name.ilike.*${safeQuery}*,handle.ilike.*${safeQuery}*,bio.ilike.*${safeQuery}*)`
		});
		if (supabaseSession?.user?.id) params.set("id", `neq.${supabaseSession.user.id}`);
		const rows = await supabaseRequest(`profiles?${params}`, { auth: true });
		return Promise.all(rows.map(async (profile) => ({ ...profile, avatar_url: await profileAvatarUrl(profile.avatar_url).catch(() => "") })));
	},
	async searchGroups(query) {
		const safeQuery = String(query || "").replace(/[(),%_*]/g, " ").trim();
		if (!safeQuery) return [];
		const params = new URLSearchParams({
			select: "id,name,description",
			order: "name.asc",
			limit: "12",
			or: `(name.ilike.*${safeQuery}*,description.ilike.*${safeQuery}*)`
		});
		return supabaseRequest(`groups?${params}`);
	},
	async getMyProfile() {
		const session = await requireSession();
		const params = new URLSearchParams({ select: "id,handle,display_name,avatar_url,profile_background_url,bio,avatar_border,profile_sticker", id: `eq.${session.user.id}`, limit: "1" });
		const rows = await supabaseRequest(`profiles?${params}`, { auth: true });
		if (!rows[0]) return null;
		return {
			...rows[0],
			avatar_url: await profileAvatarUrl(rows[0].avatar_url).catch(() => ""),
			profile_background_url: publicProfileMediaUrl(rows[0].profile_background_url) || rows[0].profile_background_url || ""
		};
	},
	async getPublicProfile(userId) {
		const auth = Boolean(supabaseSession);
		if (auth) await requireSession();
		const params = new URLSearchParams({ select: "id,handle,display_name,avatar_url,profile_background_url,bio,avatar_border,profile_sticker", id: `eq.${userId}`, limit: "1" });
		const rows = await supabaseRequest(`profiles?${params}`, { auth });
		if (!rows[0]) return null;
		return {
			...rows[0],
			avatar_url: await profileAvatarUrl(rows[0].avatar_url).catch(() => ""),
			profile_background_url: publicProfileMediaUrl(rows[0].profile_background_url) || rows[0].profile_background_url || ""
		};
	},
	async listConversations() {
		const session = await requireSession();
		const params = new URLSearchParams({
			select: "id,sender_id,recipient_id,body,created_at,sender:profiles!messages_sender_id_fkey(id,handle,display_name,avatar_url),recipient:profiles!messages_recipient_id_fkey(id,handle,display_name,avatar_url)",
			or: `(sender_id.eq.${session.user.id},recipient_id.eq.${session.user.id})`,
			order: "created_at.desc",
			limit: "300"
		});
		return supabaseRequest(`messages?${params}`, { auth: true });
	},
	async listMessages(otherUserId) {
		const session = await requireSession();
		const params = new URLSearchParams({
			select: "id,sender_id,recipient_id,body,created_at,sender:profiles!messages_sender_id_fkey(id,handle,display_name,avatar_url),recipient:profiles!messages_recipient_id_fkey(id,handle,display_name,avatar_url)",
			or: `(and(sender_id.eq.${session.user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${session.user.id}))`,
			order: "created_at.asc",
			limit: "300"
		});
		return supabaseRequest(`messages?${params}`, { auth: true });
	},
	async sendMessage(recipientId, body) {
		const session = await requireSession();
		const text = String(body || "").trim();
		if (!text) throw new TypeError("Write a message before sending.");
		const params = new URLSearchParams({
			select: "id,sender_id,recipient_id,body,created_at,sender:profiles!messages_sender_id_fkey(id,handle,display_name,avatar_url),recipient:profiles!messages_recipient_id_fkey(id,handle,display_name,avatar_url)"
		});
		const rows = await supabaseRequest(`messages?${params}`, {
			method: "POST", auth: true,
			headers: { Prefer: "return=representation" },
			body: { sender_id: session.user.id, recipient_id: recipientId, body: text }
		});
		return rows[0];
	},
	async updateMyProfile({ displayName, bio, avatarUrl, backgroundUrl, avatarBorder = "none", profileSticker = "none" }) {
		const session = await requireSession();
		const params = new URLSearchParams({ id: `eq.${session.user.id}` });
		const rows = await supabaseRequest(`profiles?${params}&select=id,handle,display_name,avatar_url,profile_background_url,bio,avatar_border,profile_sticker`, {
			method: "PATCH", auth: true,
			headers: { Prefer: "return=representation" },
			body: { display_name: displayName, bio, avatar_url: avatarUrl, profile_background_url: backgroundUrl, avatar_border: avatarBorder, profile_sticker: profileSticker }
		});
		return rows[0];
	},
	async updateMyHandle(handle) {
		const session = await requireSession();
		const params = new URLSearchParams({ id: `eq.${session.user.id}` });
		const rows = await supabaseRequest(`profiles?${params}&select=id,handle,display_name,avatar_url,bio,avatar_border,profile_sticker`, {
			method: "PATCH", auth: true,
			headers: { Prefer: "return=representation" },
			body: { handle }
		});
		return rows[0];
	},
	async listFollowedIds() {
		const session = await requireSession();
		const params = new URLSearchParams({ select: "followed_id", follower_id: `eq.${session.user.id}` });
		const rows = await supabaseRequest(`follows?${params}`, { auth: true });
		return rows.map((row) => row.followed_id);
	},
	async createComment(postId, body) {
		const session = await requireSession();
		const text = String(body || "").trim();
		if (!text) throw new TypeError("Comment text is required.");
		const rows = await supabaseRequest("post_comments?select=id,body,created_at,profiles!post_comments_user_id_fkey(display_name,handle)", {
			method: "POST", auth: true,
			headers: { Prefer: "return=representation" },
			body: { post_id: postId, user_id: session.user.id, body: text }
		});
		return rows[0];
	},
	async toggleFollow(userId, shouldFollow) {
		const session = await requireSession();
		const params = new URLSearchParams({ follower_id: `eq.${session.user.id}`, followed_id: `eq.${userId}` });
		if (shouldFollow) {
			params.set("on_conflict", "follower_id,followed_id");
			return supabaseRequest(`follows?${params}`, {
				method: "POST", auth: true,
				headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
				body: { follower_id: session.user.id, followed_id: userId }
			});
		}
		return supabaseRequest(`follows?${params}`, { method: "DELETE", auth: true });
	},
	async toggleGroupMembership(groupId, shouldJoin) {
		const session = await requireSession();
		const params = new URLSearchParams({ group_id: `eq.${groupId}`, user_id: `eq.${session.user.id}` });
		if (shouldJoin) {
			params.set("on_conflict", "group_id,user_id");
			return supabaseRequest(`groups_memberships?${params}`, {
				method: "POST", auth: true,
				headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
				body: { group_id: groupId, user_id: session.user.id }
			});
		}
		return supabaseRequest(`groups_memberships?${params}`, { method: "DELETE", auth: true });
	},
	async listGroupMemberships() {
		const session = await requireSession();
		return supabaseRequest(`groups_memberships?select=group_id&user_id=eq.${session.user.id}`, { auth: true });
	},
	async listStories() {
		await requireSession();
		const params = new URLSearchParams({
			select: "id,user_id,image_path,caption,expires_at,created_at,profiles!stories_user_id_fkey(display_name,handle,avatar_url)",
			expires_at: `gt.${new Date().toISOString()}`,
			order: "created_at.desc"
		});
		const rows = await supabaseRequest(`stories?${params}`, { auth: true });
		return Promise.all(rows.map(async (row) => ({
			...row,
			image: await privateMediaUrl(row.image_path).catch(() => ""),
			avatar: await profileAvatarUrl(row.profiles?.avatar_url).catch(() => ""),
			name: row.profiles?.display_name || "Unison member"
		})));
	},
	async createStory({ imageFile, caption = "" }) {
		const session = await requireSession();
		if (!imageFile) throw new TypeError("Choose a photo for your story.");
		const imagePath = await this.uploadPostImage(imageFile);
		const rows = await supabaseRequest("stories?select=id,user_id,image_path,caption,expires_at,created_at,profiles!stories_user_id_fkey(display_name,handle,avatar_url)", {
			method: "POST", auth: true,
			headers: { Prefer: "return=representation" },
			body: { user_id: session.user.id, image_path: imagePath, caption }
		});
		const row = rows[0];
		return {
			...row,
			image: await privateMediaUrl(row.image_path).catch(() => ""),
			avatar: await profileAvatarUrl(row.profiles?.avatar_url).catch(() => ""),
			name: row.profiles?.display_name || "Unison member"
		};
	},
	async uploadPostImage(file) {
		const session = await requireSession();
		const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
		const path = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;
		const response = await fetch(configuredUrl(`storage/v1/object/post-media/${path}`), {
			method: "POST",
			headers: {
				apikey: supabasePublishableKey,
				Authorization: `Bearer ${session.access_token}`,
				"Content-Type": file.type || "application/octet-stream",
				"x-upsert": "false"
			},
			body: file
		});
		await readResponse(response);
		return path;
	},
	async uploadProfileImage(file) {
		const session = await requireSession();
		const extension = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "") || "jpg";
		const path = `${session.user.id}/profile-${crypto.randomUUID()}.${extension}`;
		const response = await fetch(configuredUrl(`storage/v1/object/profile-media/${path}`), {
			method: "POST",
			headers: {
				apikey: supabasePublishableKey,
				Authorization: `Bearer ${session.access_token}`,
				"Content-Type": file.type || "application/octet-stream",
				"x-upsert": "false"
			},
			body: file
		});
		await readResponse(response);
		return `${supabaseUrl}/storage/v1/object/public/profile-media/${path}`;
	},

	// 10. Notifications
	async listNotifications() {
		await requireSession();
		const params = new URLSearchParams({
			select: "id,sender_id,type,entity_type,entity_id,read,created_at,sender:profiles!notifications_sender_id_fkey(id,handle,display_name,avatar_url)",
			recipient_id: `eq.${supabaseSession.user.id}`,
			order: "created_at.desc",
			limit: "100"
		});
		const rows = await supabaseRequest(`notifications?${params}`, { auth: true });
		return Promise.all(rows.map(async (row) => ({
			id: row.id,
			senderId: row.sender_id,
			type: row.type,
			entityType: row.entity_type,
			entityId: row.entity_id,
			read: row.read,
			createdAt: row.created_at,
			sender: row.sender ? {
				id: row.sender.id,
				handle: row.sender.handle ? `@${row.sender.handle}` : "@member",
				name: row.sender.display_name || "Unison member",
				avatar: await profileAvatarUrl(row.sender.avatar_url).catch(() => "")
			} : null
		})));
	},
	async createNotification({ senderId, recipientId, type, entityType, entityId }) {
		const session = await requireSession();
		const params = new URLSearchParams({ select: "id,sender_id,type,entity_type,entity_id,read,created_at,sender:profiles!notifications_sender_id_fkey(id,handle,display_name,avatar_url)" });
		const rows = await supabaseRequest("notifications", {
			method: "POST", auth: true,
			headers: { Prefer: "return=representation" },
			body: { sender_id: senderId, recipient_id: recipientId, type, entity_type: entityType, entity_id: entityId }
		});
		return rows[0];
	},
	async markNotificationRead(notificationId) {
		const session = await requireSession();
		const params = new URLSearchParams({ id: `eq.${notificationId}`, recipient_id: `eq.${session.user.id}` });
		const rows = await supabaseRequest(`notifications?${params}`, {
			method: "PATCH", auth: true,
			headers: { Prefer: "return=representation" },
			body: { read: true }
		});
		return rows[0];
	},
	async markAllNotificationsRead() {
		const session = await requireSession();
		const rows = await supabaseRequest(`notifications?recipient_id=eq.${session.user.id}&read=eq.false`, {
			method: "PATCH", auth: true,
			headers: { Prefer: "return=representation" },
			body: { read: true }
		});
		return rows.length;
	},
	async deleteNotification(notificationId) {
		const session = await requireSession();
		return supabaseRequest(`notifications?id=eq.${notificationId}&recipient_id=eq.${session.user.id}`, { method: "DELETE", auth: true });
	},
	async countUnreadNotifications() {
		await requireSession();
		const params = new URLSearchParams({ recipient_id: `eq.${supabaseSession.user.id}`, read: "eq.false" });
		const rows = await supabaseRequest(`notifications?select=id&${params}`, { auth: true });
		return rows.length;
	}
});
