// 01. Supabase client configuration and in-memory auth state
const supabaseConfig = window.UNISON_SUPABASE_CONFIG || {};
const supabaseUrl = String(supabaseConfig.url || "").replace(/\/+$/, "");
const supabasePublishableKey = String(supabaseConfig.publishableKey || "");
let supabaseSession = null;
let refreshRequest = null;
const sessionStorageKey = "unison.auth.session";

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

function mapPost(row) {
	const profile = row.profiles || {};
	const likes = row.post_likes || [];
	const comments = row.post_comments || [];
	const savedPosts = row.saved_posts || [];
	const imagePath = row.image_path || "";
	const image = imagePath.startsWith("http")
		? imagePath
		: imagePath ? `${supabaseUrl}/storage/v1/object/public/post-media/${imagePath}` : "";
	return {
		id: row.id,
		userId: row.user_id,
		author: profile.display_name || "Unison member",
		handle: profile.handle ? `@${profile.handle}` : "@member",
		time: new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-Math.max(1, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 3600000)), "hour"),
		avatar: profile.avatar_url || "",
		text: row.body,
		search: row.body,
		image,
		imageAlt: "",
		likes: likes.length,
		replies: comments.length,
		liked: Boolean(supabaseSession && likes.some((like) => like.user_id === supabaseSession.user.id)),
		saved: Boolean(supabaseSession && savedPosts.some((saved) => saved.user_id === supabaseSession.user.id)),
		local: row.scope === "townsquare",
		localType: row.scope === "townsquare" ? "Community post" : ""
	};
}

function postSelect() {
	return [
		"id", "user_id", "body", "scope", "image_path", "created_at",
		"profiles!posts_user_id_fkey(display_name,handle,avatar_url)", "post_likes(user_id)", "post_comments(id)",
		...(supabaseSession ? ["saved_posts(user_id)"] : [])
	].join(",");
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
		const params = new URLSearchParams({ select: postSelect(), order: "created_at.desc" });
		if (scope === "townsquare") params.set("scope", "eq.townsquare");
		if (scope === "home") params.set("scope", "in.(home,townsquare)");
		if (profileUserId) params.set("user_id", `eq.${profileUserId}`);
		if (scope === "mine") {
			const session = await requireSession();
			params.set("user_id", `eq.${session.user.id}`);
		}
		if (scope === "following" || scope === "saved") {
			const session = await requireSession();
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
		const rows = await supabaseRequest(`posts?${params}`);
		return rows.map(mapPost);
	},
	async createPost({ text, scope = "home", imageFile = null }) {
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
			body: { user_id: session.user.id, body: body || "", scope, image_path: imagePath }
		});
		return mapPost(rows[0]);
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
			select: "id,body,created_at,profiles!post_comments_user_id_fkey(display_name,handle)",
			post_id: `eq.${postId}`,
			order: "created_at.asc"
		});
		return supabaseRequest(`post_comments?${params}`);
	},
	async listPeople() {
		const params = new URLSearchParams({
			select: "id,handle,display_name,avatar_url,bio",
			order: "created_at.desc",
			limit: "8"
		});
		if (supabaseSession?.user?.id) params.set("id", `neq.${supabaseSession.user.id}`);
		return supabaseRequest(`profiles?${params}`);
	},
	async getMyProfile() {
		const session = await requireSession();
		const params = new URLSearchParams({ select: "id,handle,display_name,avatar_url,bio", id: `eq.${session.user.id}`, limit: "1" });
		const rows = await supabaseRequest(`profiles?${params}`, { auth: true });
		return rows[0] || null;
	},
	async getPublicProfile(userId) {
		const params = new URLSearchParams({ select: "id,handle,display_name,avatar_url,bio", id: `eq.${userId}`, limit: "1" });
		const rows = await supabaseRequest(`profiles?${params}`);
		return rows[0] || null;
	},
	async updateMyProfile({ handle, displayName, bio, avatarUrl }) {
		const session = await requireSession();
		const params = new URLSearchParams({ id: `eq.${session.user.id}` });
		const rows = await supabaseRequest(`profiles?${params}&select=id,handle,display_name,avatar_url,bio`, {
			method: "PATCH", auth: true,
			headers: { Prefer: "return=representation" },
			body: { handle, display_name: displayName, bio, avatar_url: avatarUrl }
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
			return supabaseRequest(`group_memberships?${params}`, {
				method: "POST", auth: true,
				headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
				body: { group_id: groupId, user_id: session.user.id }
			});
		}
		return supabaseRequest(`group_memberships?${params}`, { method: "DELETE", auth: true });
	},
	async listGroupMemberships() {
		const session = await requireSession();
		return supabaseRequest(`group_memberships?select=group_id&user_id=eq.${session.user.id}`, { auth: true });
	},
	async listStories() {
		const params = new URLSearchParams({
			select: "id,user_id,image_path,caption,expires_at,created_at,profiles!stories_user_id_fkey(display_name,handle,avatar_url)",
			expires_at: `gt.${new Date().toISOString()}`,
			order: "created_at.desc"
		});
		const rows = await supabaseRequest(`stories?${params}`);
		return rows.map((row) => ({
			...row,
			image: `${supabaseUrl}/storage/v1/object/public/post-media/${row.image_path}`,
			name: row.profiles?.display_name || "Unison member"
		}));
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
		return { ...row, image: `${supabaseUrl}/storage/v1/object/public/post-media/${row.image_path}`, name: row.profiles?.display_name || "Unison member" };
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
		return `${supabaseUrl}/storage/v1/object/public/post-media/${path}`;
	}
});
