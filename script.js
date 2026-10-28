	// 01. Application state
	const form = document.querySelector("#post-form");
	const input = document.querySelector("#post-text");
	const feed = document.querySelector("#feed");
	const search = document.querySelector("#search");
	const searchForm = document.querySelector("#search-form");
	const emptyState = document.querySelector("#empty-state");
	const authGate = document.querySelector("#auth-gate");
	const postScope = document.querySelector("#post-scope");
	const postVisibility = document.querySelector("#post-visibility");
	const viewTitle = document.querySelector("#view-title");
	const pageSubtitle = document.querySelector(".page-subtitle");
	const townSquareIntro = document.querySelector("#town-square-intro");
	const feedControls = document.querySelector(".feed-controls");
	const toast = document.querySelector("#toast");
	const following = new Set();
	const demoJoinedGroups = new Set();
	const demoComments = new Map();
	const photoInput = document.querySelector("#photo-input");
	const storyInput = document.querySelector("#story-input");
	const authDialog = document.querySelector("#auth-dialog");
	const storyDialog = document.querySelector("#story-dialog");
	const groupDialog = document.querySelector("#group-dialog");
	const groupForm = document.querySelector("#group-form");
	const groupsPage = document.querySelector("#groups-page");
	const groupPage = document.querySelector("#group-page");
	const groupFeed = document.querySelector("#group-feed");
	const commentsDialog = document.querySelector("#comments-dialog");
	const publicProfilePage = document.querySelector("#public-profile-page");
	const messagesPage = document.querySelector("#messages-page");
	const messageForm = document.querySelector("#message-form");
	const settingsPage = document.querySelector("#settings-page");
	const accountPage = document.querySelector("#account-page");
	const accountButton = document.querySelector("#account-button");
	const accountDropdown = document.querySelector("#account-dropdown");
	let currentView = "home";
	let currentFeed = "all";
	let activePublicProfileId = "";
	let activePublicProfileHandle = "";
	let lastRouteHash = "";
	let toastTimer;
	let signUpMode = false;
	let selectedPhoto = null;
	let activeCommentPost = null;
	let feedRequestId = 0;
	let profileRequestId = 0;
	let searchPeopleRequestId = 0;
	let searchGroupsRequestId = 0;
	let messageRequestId = 0;
	let currentProfile = null;
	let activeConversation = null;
	let previousProfileReturnView = "home";
	let previousProfileReturnScrollY = 0;
	let notifications = [];
	let unreadCount = 0;
	let notificationsRequestId = 0;
	let activeGroupId = "";
	let activeGroup = null;
	let activeGroupMembership = { role: "", status: "" };
	let groupPosts = [];
	let groupRequestId = 0;
	let pendingInviteCode = "";
	const groupCategories = ["General", "Technology", "Gaming", "Travel", "Sports", "Music", "Food", "Art", "Business", "Education", "Health", "Nature", "Automotive"];
	const fallbackAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80";
	const profileEditorAvatarPlaceholder = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#e8eef5"/><circle cx="50" cy="37" r="18" fill="#9aaabd"/><path d="M17 91c3-21 16-32 33-32s30 11 33 32" fill="#9aaabd"/></svg>')}`;
	const profileStickerGlyphs = { star: "⭐", flower: "🌸", sparkle: "✨", fire: "🔥" };
	function applyProfileDecoration(frame, border = "none", sticker = "none") {
		if (!frame) return;
		frame.dataset.border = ["none", "coral", "gold", "rainbow"].includes(border) ? border : "none";
		frame.dataset.sticker = profileStickerGlyphs[sticker] ? sticker : "none";
		const marker = frame.querySelector(".profile-sticker");
		if (marker) { marker.textContent = profileStickerGlyphs[sticker] || ""; marker.hidden = !profileStickerGlyphs[sticker]; }
	}
	function setProfileCoverPreview(url) {
		const image = document.querySelector("#profile-cover-preview-image");
		image.src = url || "";
		image.hidden = !url;
		document.querySelector("#profile-cover-preview").classList.toggle("has-image", Boolean(url));
		document.querySelector("#profile-cover-placeholder").hidden = Boolean(url);
		renderMyProfilePreview();
	}
	function renderMyProfilePreview() {
		const name = document.querySelector("#profile-display-name");
		const handle = document.querySelector("#profile-handle-display");
		const bio = document.querySelector("#profile-bio");
		if (!name || !handle || !bio) return;
		document.querySelector("#profile-others-name").textContent = name.value.trim() || "Your name";
		document.querySelector("#profile-others-handle").textContent = handle.textContent || "@member";
		document.querySelector("#profile-others-bio").textContent = bio.value.trim();
		document.querySelector("#profile-others-avatar").src = document.querySelector("#profile-avatar-preview").src || profileEditorAvatarPlaceholder;
		applyProfileDecoration(document.querySelector("#profile-others-frame"), document.querySelector("#profile-border").value, document.querySelector("#profile-sticker").value);
		const coverPreview = document.querySelector("#profile-cover-preview-image");
		const cover = document.querySelector("#profile-others-cover");
		const coverImage = document.querySelector("#profile-others-cover-image");
		coverImage.src = coverPreview.hidden ? "" : coverPreview.src;
		cover.hidden = coverPreview.hidden;
	}
	function loadAppearance() {
		try {
			const saved = JSON.parse(window.localStorage.getItem("unison.appearance") || "null");
			return { accent: ["coral", "lime", "blue"].includes(saved?.accent) ? saved.accent : "coral", theme: saved?.theme === "dim" ? "dim" : "light", compact: Boolean(saved?.compact) };
		} catch {
			return { accent: "coral", theme: "light", compact: false };
		}
	}
	let appearance = loadAppearance();
	function saveAppearance() {
		try { window.localStorage.setItem("unison.appearance", JSON.stringify(appearance)); } catch { /* Keep settings for this page session. */ }
	}

	function showToast(message) {
		toast.textContent = message;
		toast.classList.add("show");
		window.clearTimeout(toastTimer);
		toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2000);
	}

	function profileErrorMessage(error) {
		const message = error?.message || "Could not load or save your profile.";
		if (/profile_background_url/i.test(message) && /column|schema cache|does not exist/i.test(message)) {
			return "Supabase is missing the profile background column. Run the updated supabase-private-community-migration.sql in the SQL Editor, then refresh.";
		}
		return message;
	}

	function persistActiveView() {
		try {
			window.sessionStorage.setItem("unison.active-view", JSON.stringify({
				view: currentView,
				feed: currentFeed,
				search: search.value,
				profileId: activePublicProfileId,
				profileHandle: activePublicProfileHandle,
				groupId: activeGroupId
			}));
		} catch { /* Keep navigation usable when browser storage is unavailable. */ }
	}

	function requireSignedIn() {
		if (!window.UnisonApi.isConfigured()) {
			showToast("Add your Supabase project URL and publishable key to enable accounts.");
			return false;
		}
		if (!window.UnisonAuth.getUser()) {
			openAuthDialog();
			return false;
		}
		return true;
	}

	function openAuthDialog(message = "Sign in to post, like, save, and join groups.") {
		if (!window.UnisonApi.isConfigured()) {
			showToast("Supabase is not configured yet.");
			return;
		}
		document.querySelector("#auth-message").textContent = message;
		if (!authDialog.open) authDialog.showModal();
	}

	function updateAccount(user, profile = currentProfile) {
		const label = document.querySelector("#account-label");
		const name = document.querySelector("#sidebar-account-name");
		const handle = document.querySelector("#sidebar-account-handle");
		const metadata = user?.user_metadata || {};
		const displayName = profile?.display_name || metadata.display_name || user?.email?.split("@")[0] || "Alex Morgan";
		label.textContent = user ? displayName : "Sign in";
		name.textContent = displayName;
		handle.textContent = profile?.handle ? `@${profile.handle}` : metadata.handle ? `@${metadata.handle}` : user ? user.email : "@alexm";
		const avatar = profile?.avatar_url || metadata.avatar_url || fallbackAvatar;
		document.querySelectorAll("#account-button .avatar, .account .avatar, #composer-avatar").forEach((image) => { image.src = avatar; });
		document.querySelector("#profile-avatar-preview").src = profile?.avatar_url || metadata.avatar_url || profileEditorAvatarPlaceholder;
		document.querySelector("#auth-signout").hidden = !user;
	}

	async function loadMyProfile() {
		if (!window.UnisonAuth.getUser() || !window.UnisonApi.isConfigured()) return null;
		currentProfile = await window.UnisonApi.getMyProfile();
		updateAccount(window.UnisonAuth.getUser(), currentProfile);
		if (currentProfile) {
			document.querySelector("#profile-display-name").value = currentProfile.display_name || "";
			document.querySelector("#profile-handle-display").textContent = currentProfile.handle ? `@${currentProfile.handle}` : "@member";
			document.querySelector("#profile-bio").value = currentProfile.bio || "";
			document.querySelector("#profile-avatar-preview").src = currentProfile.avatar_url || profileEditorAvatarPlaceholder;
			setProfileCoverPreview(currentProfile.profile_background_url || "");
			document.querySelector("#profile-border").value = currentProfile.avatar_border || "none";
			document.querySelector("#profile-sticker").value = currentProfile.profile_sticker || "none";
			applyProfileDecoration(document.querySelector("#profile-avatar-frame"), currentProfile.avatar_border, currentProfile.profile_sticker);
			renderMyProfilePreview();
		}
		return currentProfile;
	}

	// 02. Notification helpers
	function relativeTime(timestamp) {
		if (!timestamp) return "";
		const date = new Date(timestamp);
		const now = new Date();
		const seconds = Math.floor((now - date) / 1000);
		if (seconds < 60) return "just now";
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d`;
		return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}

	function formatProfilePostTime(createdAt) {
		if (!createdAt) return "";
		const date = new Date(createdAt);
		const now = new Date();
		const diffMs = now - date;
		const diffHours = diffMs / (1000 * 60 * 60);
		if (diffHours < 24) {
			const diffMins = Math.floor(diffMs / (1000 * 60));
			if (diffMins < 1) return "just now";
			if (diffMins < 60) return `${diffMins}m ago`;
			return `${Math.floor(diffHours)}h ago`;
		}
		return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + " · " + date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
	}

	function notificationText(notification) {
		const sender = notification.sender ? notification.sender.name : "Someone";
		switch (notification.type) {
			case "like": return `${sender} liked your ${notification.entityType}`;
			case "comment": return `${sender} commented on your ${notification.entityType}`;
			case "follow": return `${sender} followed you`;
			case "mention": return `${sender} mentioned you in a ${notification.entityType}`;
			default: return `${sender} interacted with your ${notification.entityType}`;
		}
	}

	function createNotificationElement(notification) {
		const item = document.createElement("article");
		item.className = `notification-item${notification.read ? "" : " unread"}`;
		item.dataset.notificationId = notification.id;
		const avatar = document.createElement("img");
		avatar.className = "notification-avatar";
		avatar.src = (notification.sender && notification.sender.avatar) || fallbackAvatar;
		avatar.alt = "";
		const content = document.createElement("div");
		content.className = "notification-content";
		const text = document.createElement("p");
		text.className = "notification-text";
		text.textContent = notificationText(notification);
		const time = document.createElement("div");
		time.className = "notification-time";
		time.textContent = relativeTime(notification.createdAt);
		content.append(text, time);
		const del = document.createElement("button");
		del.className = "notification-delete";
		del.type = "button";
		del.dataset.deleteNotification = notification.id;
		del.textContent = "×";
		del.setAttribute("aria-label", "Delete notification");
		item.append(avatar, content, del);
		return item;
	}

	function renderNotifications(listElement, items) {
		listElement.replaceChildren();
		if (!items.length) {
			const empty = document.createElement("p");
			empty.className = "notifications-empty";
			empty.textContent = "No notifications yet.";
			listElement.append(empty);
			return;
		}
		listElement.replaceChildren(...items.map(createNotificationElement));
	}

	async function refreshNotifications() {
		if (!window.UnisonApi.isConfigured() || !window.UnisonAuth.getUser()) return;
		const requestId = ++notificationsRequestId;
		try {
			const list = await window.UnisonApi.listNotifications();
			if (requestId !== notificationsRequestId) return;
			notifications = list;
			unreadCount = list.filter((n) => !n.read).length;
			const dropdownList = document.querySelector("#notifications-dropdown .notifications-list");
			const pageList = document.querySelector("#notifications-page .notifications-list");
			if (dropdownList) renderNotifications(dropdownList, notifications.slice(0, 20));
			if (pageList) renderNotifications(pageList, notifications);
			updateUnreadBadge();
		} catch (error) {
			showToast(error.message);
		}
	}

	function updateUnreadBadge() {
		const badge = document.querySelector("#notifications-count");
		if (!badge) return;
		if (unreadCount > 0) {
			badge.textContent = String(unreadCount);
			badge.hidden = false;
		} else {
			badge.hidden = true;
		}
	}

	async function markNotificationRead(notificationId) {
		if (!requireSignedIn()) return;
		try {
			await window.UnisonApi.markNotificationRead(notificationId);
			const notification = notifications.find((n) => n.id === notificationId);
			if (notification) {
				notification.read = true;
				unreadCount = Math.max(0, unreadCount - 1);
				updateUnreadBadge();
				document.querySelectorAll(`[data-notification-id="${notificationId}"]`).forEach((item) => item.classList.remove("unread"));
			}
		} catch (error) {
			showToast(error.message);
		}
	}

	async function markAllNotificationsRead() {
		if (!requireSignedIn()) return;
		try {
			await window.UnisonApi.markAllNotificationsRead();
			notifications.forEach((n) => { n.read = true; });
			unreadCount = 0;
			updateUnreadBadge();
			document.querySelectorAll(".notification-item").forEach((item) => item.classList.remove("unread"));
			showToast("All notifications marked as read.");
		} catch (error) {
			showToast(error.message);
		}
	}

	async function deleteNotification(notificationId) {
		if (!requireSignedIn()) return;
		try {
			await window.UnisonApi.deleteNotification(notificationId);
			notifications = notifications.filter((n) => n.id !== notificationId);
			unreadCount = notifications.filter((n) => !n.read).length;
			updateUnreadBadge();
			const dropdownList = document.querySelector("#notifications-dropdown .notifications-list");
			const pageList = document.querySelector("#notifications-page .notifications-list");
			if (dropdownList) renderNotifications(dropdownList, notifications.slice(0, 20));
			if (pageList) renderNotifications(pageList, notifications);
		} catch (error) {
			showToast(error.message);
		}
	}

	async function createActivityNotification({ recipientId, type, entityType, entityId }) {
		if (!window.UnisonApi.isConfigured()) return;
		const user = window.UnisonAuth.getUser();
		if (!user || recipientId === user.id) return;
		try {
			await window.UnisonApi.createNotification({ senderId: user.id, recipientId, type, entityType, entityId });
		} catch {
			// Notification creation should never break the main action.
		}
	}

	// 02. Feed rendering and filtering
	function renderPostText(element, value) {
		element.replaceChildren();
		String(value || "").split(/(#[A-Za-z0-9_]+)/g).forEach((part) => {
			if (part.startsWith("#")) {
				const tag = document.createElement("span");
				tag.className = "tag";
				tag.textContent = part;
				element.append(tag);
			} else {
				element.append(document.createTextNode(part));
			}
		});
	}

	function renderPost(postData) {
		const template = document.querySelector("#post-template");
		const post = template.content.firstElementChild.cloneNode(true);
		if (postData.id) post.dataset.postId = postData.id;
		if (postData.userId) post.dataset.userId = postData.userId;
		if (postData.saved) post.classList.add("saved");
		post.dataset.author = postData.handle;
		post.dataset.search = `${postData.author} ${postData.handle} ${postData.search || ""} ${postData.text}`.toLowerCase();
		const currentUser = window.UnisonAuth.getUser();
		const canModerate = Boolean(postData.canModerate);
		post.querySelector("[data-owner-menu-wrap]").hidden = !currentUser || (postData.userId !== currentUser.id && !canModerate);
		if (canModerate) {
			const ownerMenu = post.querySelector("[data-owner-menu]");
			const pin = document.createElement("button");
			pin.type = "button";
			pin.dataset.ownerAction = "pin";
			pin.textContent = postData.pinned ? "Unpin post" : "Pin post";
			ownerMenu.prepend(pin);
		}
		if (postData.pinned) {
			post.classList.add("pinned");
			post.querySelector('[data-field="pinned-badge"]').hidden = false;
		} else {
			post.querySelector('[data-field="pinned-badge"]').remove();
		}

		if (postData.local || postData.community || postData.visibility === "private") {
			post.classList.add("town-square-post");
			if (postData.local) post.dataset.local = "true";
			if (postData.community) post.dataset.community = "true";
			const labels = [];
			if (postData.community) labels.push("Community feed");
			else if (postData.local) labels.push("Townsquare");
			if (postData.visibility === "private") labels.push("Only you");
			post.querySelector('[data-field="local-meta"]').textContent = labels.join(" · ");
		} else {
			post.querySelector('[data-field="local-meta"]').remove();
		}

		post.querySelector('[data-field="avatar"]').src = postData.avatar || fallbackAvatar;
		applyProfileDecoration(post.querySelector('[data-field="avatar-frame"]'), postData.avatarBorder, postData.profileSticker);
		post.querySelectorAll("[data-profile-link]").forEach((profileLink) => {
			profileLink.dataset.profileId = postData.userId || "";
			profileLink.dataset.profileHandle = postData.handle || "";
			if (profileLink.classList.contains("post-avatar-link")) profileLink.setAttribute("aria-label", `Open ${postData.author}'s profile`);
		});
		post.querySelector('[data-field="author"]').textContent = postData.author;
		post.querySelector('[data-field="handle"]').textContent = postData.handle;
		post.querySelector('[data-field="time"]').textContent = `· ${postData.time}`;
		renderPostText(post.querySelector('[data-field="text"]'), postData.text);

		if (postData.image) {
			const image = post.querySelector('[data-field="image"]');
			image.src = postData.image;
			image.alt = postData.imageAlt || "";
		} else {
			post.querySelector('[data-field="image"]').remove();
		}

		const likeButton = post.querySelector('[data-action="like"]');
		likeButton.setAttribute("aria-pressed", String(Boolean(postData.liked)));
		likeButton.classList.toggle("liked", Boolean(postData.liked));
		likeButton.querySelector("[data-count]").textContent = String(postData.likes || 0);
		likeButton.querySelector("[data-label]").textContent = postData.liked ? "Liked" : "Like";
		likeButton.querySelector('[data-field="like-icon"]').textContent = postData.liked ? "♥" : "♡";
		const saveButton = post.querySelector('[data-action="save"]');
		saveButton.setAttribute("aria-pressed", String(Boolean(postData.saved)));
		saveButton.classList.toggle("saved", Boolean(postData.saved));
		saveButton.querySelector("[data-label]").textContent = postData.saved ? "Saved" : "Save";
		post.querySelector('[data-field="replies"]').textContent = `${postData.replies || 0} replies`;
		return post;
	}

	let feedPosts = window.UnisonAuth.getUser() ? [] : [...window.UnisonData.posts];
	function renderFeed() {
		feed.replaceChildren(...feedPosts.map(renderPost));
		applyFilters();
	}

	function setGroupButton(button, joined, pending = false) {
		button.setAttribute("aria-pressed", String(joined));
		button.classList.toggle("joined", joined);
		button.classList.toggle("pending", pending);
		button.textContent = joined ? "Joined" : pending ? "Requested" : "Join";
	}

	function setFollowButton(button, isFollowing) {
		button.setAttribute("aria-pressed", String(isFollowing));
		button.classList.toggle("following", isFollowing);
		button.textContent = isFollowing ? "Following" : "Follow";
	}

	async function refreshGroupMemberships() {
		if (!window.UnisonApi.isConfigured() || !window.UnisonAuth.getUser()) return;
		const memberships = await window.UnisonApi.listGroupMemberships();
		const state = new Map(memberships.map((membership) => [membership.group_id, membership.status]));
		document.querySelectorAll("[data-group-id]").forEach((button) => {
			const status = state.get(button.dataset.groupId);
			setGroupButton(button, status === "approved", status === "pending");
		});
	}

	async function refreshPeople() {
		if (!window.UnisonApi.isConfigured()) return;
		const people = await window.UnisonApi.listPeople();
		const list = document.querySelector("#people-list");
		list.replaceChildren();
		people.forEach((person) => {
			const row = document.createElement("div");
			row.className = "person";
			row.dataset.profileId = person.id;
			row.dataset.profileHandle = person.handle || "";
			const avatar = document.createElement("img");
			avatar.className = "avatar";
			avatar.src = person.avatar_url || fallbackAvatar;
			avatar.alt = "";
			const details = document.createElement("div");
			details.className = "person-meta";
			const name = document.createElement("span");
			name.className = "person-name";
			name.textContent = person.display_name || person.handle;
			const handle = document.createElement("span");
			handle.className = "person-handle";
			handle.textContent = `@${person.handle}`;
			const profileLink = document.createElement("button");
			profileLink.className = "person-profile-link";
			profileLink.type = "button";
			profileLink.dataset.profileId = person.id;
			profileLink.dataset.profileHandle = person.handle || "";
			profileLink.append(name, handle);
			details.append(profileLink);
			if (person.bio) {
				const bio = document.createElement("span");
				bio.className = "person-bio";
				bio.textContent = person.bio;
				details.append(bio);
			}
			const follow = document.createElement("button");
			follow.className = "follow";
			follow.type = "button";
			follow.dataset.followId = person.id;
			follow.setAttribute("aria-pressed", "false");
			follow.textContent = "Follow";
			row.append(avatar, details, follow);
			list.append(row);
		});
		await refreshFollowState();
	}

	async function refreshFriends() {
		if (!window.UnisonApi.isConfigured() || !window.UnisonAuth.getUser()) return;
		const list = document.querySelector("#contact-list");
		list.replaceChildren();
		const followedIds = new Set(await window.UnisonApi.listFollowedIds());
		const people = await window.UnisonApi.listPeople();
		const friends = people.filter((person) => followedIds.has(person.id));
		if (!friends.length) {
			const empty = document.createElement("p");
			empty.className = "profile-posts-empty";
			empty.textContent = "No friends yet. Follow people to see them here.";
			list.append(empty);
			return;
		}
		friends.forEach((person) => {
			const row = document.createElement("div");
			row.className = "contact";
			row.dataset.profileId = person.id;
			const avatar = document.createElement("img");
			avatar.className = "avatar";
			avatar.src = person.avatar_url || fallbackAvatar;
			avatar.alt = "";
			const name = document.createElement("span");
			name.className = "contact-name";
			name.textContent = person.display_name || person.handle;
			const online = document.createElement("span");
			online.className = "online-dot";
			online.setAttribute("aria-label", "Online");
			const follow = document.createElement("button");
			follow.className = "follow";
			follow.type = "button";
			follow.dataset.followId = person.id;
			follow.setAttribute("aria-pressed", "true");
			follow.textContent = "Following";
			row.append(avatar, name, online, follow);
			list.append(row);
		});
	}

	async function refreshSearchPeople(query) {
		const requestId = ++searchPeopleRequestId;
		const section = document.querySelector("#search-people-section");
		const list = document.querySelector("#search-people-list");
		let people;
		if (window.UnisonApi.isConfigured()) {
			people = await window.UnisonApi.searchPeople(query);
		} else {
			const seen = new Set();
			people = feedPosts.filter((post) => {
				const key = (post.handle || "").toLowerCase();
				if (!key || seen.has(key) || !`${post.author} ${post.handle}`.toLowerCase().includes(query.toLowerCase())) return false;
				seen.add(key);
				return true;
			}).map((post) => ({ id: post.userId || "", handle: post.handle?.replace(/^@/, "") || "member", display_name: post.author, avatar_url: post.avatar, bio: "" }));
		}
		if (requestId !== searchPeopleRequestId) return;
		list.replaceChildren(...people.map((person) => {
			const button = document.createElement("button");
			button.className = "search-person-profile";
			button.type = "button";
			button.dataset.profileId = person.id || "";
			button.dataset.profileHandle = person.handle || "";
			const avatar = document.createElement("img");
			avatar.className = "avatar";
			avatar.src = person.avatar_url || fallbackAvatar;
			avatar.alt = "";
			const details = document.createElement("span");
			details.className = "search-person-details";
			const name = document.createElement("strong");
			name.textContent = person.display_name || person.handle || "Unison member";
			const handle = document.createElement("span");
			handle.className = "person-handle";
			handle.textContent = person.handle ? `@${person.handle}` : "@member";
			details.append(name, handle);
			button.append(avatar, details);
			if (person.bio) {
				const bio = document.createElement("span");
				bio.className = "search-person-bio";
				bio.textContent = person.bio;
				button.append(bio);
			}
			return button;
		}));
		section.hidden = !people.length;
	}

	function groupMembersLabel(count) {
		return `${count || 0} ${count === 1 ? "member" : "members"}`;
	}

	function createGroupCard(group, membership) {
		const card = document.createElement("article");
		card.className = "group-card";
		card.dataset.openGroup = group.id;
		const image = document.createElement("img");
		image.className = "group-card-avatar";
		image.src = group.avatar || fallbackAvatar;
		image.alt = "";
		const body = document.createElement("div");
		body.className = "group-card-body";
		const name = document.createElement("strong");
		name.className = "group-card-name";
		name.textContent = group.name;
		const meta = document.createElement("span");
		meta.className = "group-card-meta";
		meta.textContent = `${group.privacy === "private" ? "Private" : "Public"} · ${group.category || "General"} · ${groupMembersLabel(group.memberCount)}`;
		const description = document.createElement("p");
		description.textContent = group.description || "A group for people with shared interests.";
		body.append(name, meta, description);
		const join = document.createElement("button");
		join.className = "join-button";
		join.type = "button";
		join.dataset.groupId = group.id;
		setGroupButton(join, membership === "approved", membership === "pending");
		card.append(image, body, join);
		return card;
	}

	async function loadGroupMembershipStates() {
		if (!window.UnisonApi.isConfigured() || !window.UnisonAuth.getUser()) return new Map();
		const memberships = await window.UnisonApi.listGroupMemberships();
		return new Map(memberships.map((membership) => [membership.group_id, membership.status]));
	}

	async function refreshSearchGroups(query) {
		const requestId = ++searchGroupsRequestId;
		const section = document.querySelector("#search-groups-section");
		const list = document.querySelector("#search-groups-list");
		let groups;
		try {
			if (window.UnisonApi.isConfigured()) {
				groups = await window.UnisonApi.listDiscoverGroups({ search: query, limit: 12 });
			} else {
				groups = [...document.querySelectorAll(".right-rail [data-group-id]")]
					.filter((button) => button.closest(".suggestion")?.textContent.toLowerCase().includes(query.toLowerCase()))
					.map((button) => ({ id: button.dataset.groupId, name: button.closest(".suggestion").querySelector("strong")?.textContent || "Group", description: "Join the conversation.", memberCount: 0, privacy: "public", category: "General" }));
			}
		} catch (error) {
			if (requestId !== searchGroupsRequestId) return;
			section.hidden = true;
			showToast(error.message);
			return;
		}
		if (requestId !== searchGroupsRequestId) return;
		const membershipStates = window.UnisonApi.isConfigured() ? await loadGroupMembershipStates() : new Map();
		if (requestId !== searchGroupsRequestId) return;
		list.replaceChildren(...groups.map((group) => createGroupCard(group, membershipStates.get(group.id))));
		section.hidden = !groups.length;
	}

	// 02b. Groups hub and group page
	function groupEmptyMessage(container, message) {
		const empty = document.createElement("p");
		empty.className = "group-empty";
		empty.textContent = message;
		container.replaceChildren(empty);
	}

	function populateGroupCategories() {
		const filter = document.querySelector("#groups-category-filter");
		const select = document.querySelector("#group-category");
		if (filter && filter.options.length <= 1) {
			groupCategories.forEach((category) => filter.append(new Option(category, category)));
		}
		if (select && !select.options.length) {
			groupCategories.forEach((category) => select.append(new Option(category, category)));
		}
	}

	async function renderGroupsHub() {
		const mine = document.querySelector("#groups-mine");
		const discover = document.querySelector("#groups-discover");
		if (!window.UnisonApi.isConfigured()) {
			groupEmptyMessage(mine, "Connect Supabase to create and join groups.");
			groupEmptyMessage(discover, "Connect Supabase to browse groups.");
			return;
		}
		const searchValue = document.querySelector("#groups-search").value.trim();
		const category = document.querySelector("#groups-category-filter").value;
		const membershipStates = await loadGroupMembershipStates();
		if (window.UnisonAuth.getUser()) {
			const myGroups = await window.UnisonApi.listMyGroups();
			if (!myGroups.length) groupEmptyMessage(mine, "You haven't joined any groups yet. Find one below to get started.");
			else mine.replaceChildren(...myGroups.map((group) => createGroupCard(group, group.status)));
		} else {
			groupEmptyMessage(mine, "Sign in to see the groups you belong to.");
		}
		const groups = await window.UnisonApi.listDiscoverGroups({ search: searchValue, category });
		if (!groups.length) groupEmptyMessage(discover, "No groups match your search yet.");
		else discover.replaceChildren(...groups.map((group) => createGroupCard(group, membershipStates.get(group.id))));
	}

	function groupIsModerator() {
		return activeGroupMembership.status === "approved" && ["owner", "admin"].includes(activeGroupMembership.role);
	}

	async function openGroup(groupId) {
		if (!requireSignedIn()) return;
		if (!window.UnisonApi.isConfigured()) { showToast("Connect Supabase to open groups."); return; }
		const requestId = ++groupRequestId;
		activeGroupId = groupId;
		setView("group");
		document.querySelector("#group-page-name").textContent = "Loading group…";
		try {
			const [group, memberships, members, posts] = await Promise.all([
				window.UnisonApi.getGroupDetail(groupId),
				window.UnisonApi.listGroupMemberships(),
				window.UnisonApi.listGroupMembers(groupId).catch(() => []),
				window.UnisonApi.listPosts({ scope: "group", groupId })
			]);
			if (requestId !== groupRequestId) return;
			if (!group) { showToast("This group could not be found."); setView("groups"); return; }
			const mine = memberships.find((membership) => membership.group_id === groupId);
			activeGroup = group;
			activeGroupMembership = { role: mine?.role || "", status: mine?.status || "" };
			groupMembers = members;
			const canModerate = groupIsModerator();
			groupPosts = posts.map((post) => ({ ...post, canModerate }));
			renderGroupDetail();
			renderGroupFeed();
			renderGroupMembers();
		} catch (error) {
			if (requestId !== groupRequestId) return;
			showToast(error.message);
		}
	}

	function renderGroupDetail() {
		const group = activeGroup;
		if (!group) return;
		const approvedMembers = groupMembers.filter((member) => member.status === "approved");
		const isMember = activeGroupMembership.status === "approved";
		const isPending = activeGroupMembership.status === "pending";
		const canModerate = groupIsModerator();
		document.querySelector("#group-page-name").textContent = group.name;
		document.querySelector("#group-privacy-label").textContent = `${group.privacy === "private" ? "PRIVATE" : "PUBLIC"} GROUP`;
		document.querySelector("#group-page-meta").textContent = `${group.category || "General"} · ${groupMembersLabel(approvedMembers.length)}`;
		document.querySelector("#group-page-description").textContent = group.description || "This group has not added a description yet.";
		const avatar = document.querySelector("#group-avatar");
		avatar.src = group.avatar || fallbackAvatar;
		avatar.alt = `${group.name} group picture`;
		const cover = document.querySelector("#group-cover");
		const coverImage = document.querySelector("#group-cover-image");
		if (group.cover) {
			cover.hidden = false;
			coverImage.src = group.cover;
			coverImage.alt = `${group.name} cover photo`;
		} else {
			cover.hidden = true;
			coverImage.removeAttribute("src");
		}
		const join = document.querySelector("#group-join");
		join.hidden = isMember;
		join.disabled = isPending;
		join.classList.toggle("pending", isPending);
		join.textContent = isPending ? "Requested" : "Join group";
		const manage = document.querySelector("#group-manage-toggle");
		manage.hidden = !canModerate;
		const admin = document.querySelector("#group-admin");
		if (!canModerate) admin.hidden = true;
		manage.textContent = admin.hidden ? "Manage" : "Hide management";
		const inviteBox = document.querySelector("#group-invite-box");
		inviteBox.hidden = !canModerate;
		if (canModerate) {
			const link = document.querySelector("#group-invite-link");
			link.value = group.invite_code ? `${location.origin}${location.pathname}#invite/${group.invite_code}` : "";
			link.placeholder = group.invite_code ? "" : "Generate a link to invite people";
		}
		document.querySelector("#group-post-form").hidden = !isMember;
	}

	function createMemberRow(member, isRequest) {
		const row = document.createElement("div");
		row.className = "group-member-row";
		row.dataset.memberId = member.userId;
		const avatar = document.createElement("img");
		avatar.className = "group-member-avatar";
		avatar.src = member.avatar || fallbackAvatar;
		avatar.alt = "";
		const info = document.createElement("div");
		info.className = "group-member-info";
		const name = document.createElement("strong");
		name.textContent = member.name;
		const handle = document.createElement("span");
		handle.textContent = `@${member.handle || "member"}${member.role && member.role !== "member" ? ` · ${member.role}` : ""}`;
		info.append(name, handle);
		row.append(avatar, info);
		const isSelf = member.userId === window.UnisonAuth.getUser()?.id;
		if (groupIsModerator() && !isSelf) {
			if (isRequest) {
				const approve = document.createElement("button");
				approve.className = "join-button";
				approve.type = "button";
				approve.dataset.memberAction = "approve";
				approve.textContent = "Approve";
				const decline = document.createElement("button");
				decline.className = "text-link";
				decline.type = "button";
				decline.dataset.memberAction = "decline";
				decline.textContent = "Decline";
				row.append(approve, decline);
			} else {
				const owner = activeGroupMembership.role === "owner";
				if (owner && member.role !== "owner") {
					const promote = document.createElement("button");
					promote.className = "text-link";
					promote.type = "button";
					promote.dataset.memberAction = member.role === "admin" ? "demote" : "promote";
					promote.textContent = member.role === "admin" ? "Remove admin" : "Make admin";
					row.append(promote);
				}
				if (member.role !== "owner") {
					const remove = document.createElement("button");
					remove.className = "text-link";
					remove.type = "button";
					remove.dataset.memberAction = "remove";
					remove.textContent = "Remove";
					row.append(remove);
				}
			}
		}
		return row;
	}

	function renderGroupMembers() {
		const requests = groupMembers.filter((member) => member.status === "pending");
		const approved = groupMembers.filter((member) => member.status === "approved");
		document.querySelector("#group-request-count").textContent = String(requests.length);
		document.querySelector("#group-member-count").textContent = String(approved.length);
		const requestList = document.querySelector("#group-requests");
		if (!requests.length) groupEmptyMessage(requestList, "No pending join requests.");
		else requestList.replaceChildren(...requests.map((member) => createMemberRow(member, true)));
		const memberList = document.querySelector("#group-members");
		if (!approved.length) groupEmptyMessage(memberList, "No members to show yet.");
		else memberList.replaceChildren(...approved.map((member) => createMemberRow(member, false)));
	}

	function renderGroupFeed() {
		if (!groupFeed) return;
		if (!groupPosts.length) {
			groupEmptyMessage(groupFeed, "No posts in this group yet. Be the first to share something.");
			return;
		}
		groupFeed.replaceChildren(...groupPosts.map(renderPost));
	}

	async function refreshGroupFeed() {
		if (!activeGroupId) return;
		const posts = await window.UnisonApi.listPosts({ scope: "group", groupId: activeGroupId });
		const canModerate = groupIsModerator();
		groupPosts = posts.map((post) => ({ ...post, canModerate }));
		renderGroupFeed();
	}

	async function refreshFollowState() {
		if (!window.UnisonApi.isConfigured() || !window.UnisonAuth.getUser()) return;
		const followedIds = new Set(await window.UnisonApi.listFollowedIds());
		document.querySelectorAll("[data-follow-id]").forEach((button) => setFollowButton(button, followedIds.has(button.dataset.followId)));
	}

	async function openPublicProfile(userId, rawHandle = "") {
		const requestId = ++profileRequestId;
		activePublicProfileId = userId || "";
		activePublicProfileHandle = String(rawHandle || "").replace(/^@/, "");
		if (currentView !== "public-profile") {
			previousProfileReturnView = currentView;
			previousProfileReturnScrollY = window.scrollY;
		}
		setView("public-profile");
		window.scrollTo(0, 0);
		const cleanHandle = String(rawHandle).replace(/^@/, "");
		const name = document.querySelector("#public-profile-name");
		const handle = document.querySelector("#public-profile-handle");
		const bio = document.querySelector("#public-profile-bio");
		const avatar = document.querySelector("#public-profile-avatar");
		const posts = document.querySelector("#public-profile-posts");
		const follow = document.querySelector("#public-profile-follow");
		const message = document.querySelector("#public-profile-message");
		name.textContent = "Loading profile…";
		handle.textContent = cleanHandle ? `@${cleanHandle}` : "";
		bio.textContent = "";
		avatar.src = fallbackAvatar;
		document.querySelector("#public-profile-cover").hidden = true;
		document.querySelector("#public-profile-cover-image").removeAttribute("src");
		posts.replaceChildren(Object.assign(document.createElement("p"), { className: "profile-posts-empty", textContent: "Loading posts…" }));
		follow.hidden = true;
		message.hidden = true;
		try {
			let profile;
			let profilePosts;
			if (window.UnisonApi.isConfigured() && userId) {
				[profile, profilePosts] = await Promise.all([
					window.UnisonApi.getPublicProfile(userId),
					window.UnisonApi.listPosts({ scope: "profile", profileUserId: userId })
				]);
				if (!profile) throw new Error("This profile could not be found.");
			} else {
				const matchingPosts = feedPosts.filter((post) => post.handle?.replace(/^@/, "").toLowerCase() === cleanHandle.toLowerCase());
				const post = matchingPosts[0];
				profile = { display_name: post?.author || cleanHandle || "Unison member", handle: cleanHandle, avatar_url: post?.avatar || "", bio: "" };
				profilePosts = matchingPosts;
			}
			if (requestId !== profileRequestId) return;
			if (profile.id && profile.id === window.UnisonAuth.getUser()?.id) {
				profilePosts = profilePosts.filter((post) => post.visibility === "public");
			}
			name.textContent = profile.display_name || "Unison member";
			handle.textContent = profile.handle ? `@${profile.handle}` : "@member";
			bio.textContent = profile.bio || "";
			avatar.src = profile.avatar_url || fallbackAvatar;
			const coverImage = document.querySelector("#public-profile-cover-image");
			coverImage.src = profile.profile_background_url || "";
			document.querySelector("#public-profile-cover").hidden = !profile.profile_background_url;
			applyProfileDecoration(document.querySelector("#public-profile-frame"), profile.avatar_border, profile.profile_sticker);
			const signedInUser = window.UnisonAuth.getUser();
			if (profile.id && signedInUser && profile.id !== signedInUser.id) {
				message.hidden = false;
				message.dataset.profileId = profile.id;
				message.dataset.profileName = profile.display_name || "Unison member";
				message.dataset.profileHandle = profile.handle ? `@${profile.handle}` : "@member";
				message.dataset.profileAvatar = profile.avatar_url || fallbackAvatar;
			}
			if (profile.id && window.UnisonAuth.getUser() && profile.id !== window.UnisonAuth.getUser().id) {
				follow.hidden = false;
				follow.dataset.followId = profile.id;
				if (window.UnisonAuth.getUser()) {
					const followed = new Set(await window.UnisonApi.listFollowedIds());
					if (requestId !== profileRequestId) return;
					setFollowButton(follow, followed.has(profile.id));
				} else setFollowButton(follow, false);
			}
			if (requestId !== profileRequestId) return;
			avatar.alt = `${profile.display_name || "Member"}'s profile picture`;
			if (!profilePosts.length) {
				posts.replaceChildren(Object.assign(document.createElement("p"), { className: "profile-posts-empty", textContent: "No posts yet." }));
				return;
			}
			posts.replaceChildren(...profilePosts.map((post) => {
				const card = document.createElement("article");
				card.className = "profile-post-card";
				card.dataset.postId = post.id || "";
				card.dataset.userId = post.userId || "";
				const copy = document.createElement("p");
				copy.textContent = post.text || "";
				card.append(copy);
				if (post.image) {
					const image = document.createElement("img");
					image.src = post.image;
					image.alt = post.imageAlt || "Post attachment";
					image.loading = "lazy";
					card.append(image);
				}
				const timeEl = document.createElement("time");
				timeEl.className = "profile-post-time";
				timeEl.dateTime = post.createdAt || "";
				timeEl.textContent = post.createdAt ? formatProfilePostTime(post.createdAt) : (post.time ? `· ${post.time}` : "");
				card.append(timeEl);
				const actions = document.createElement("div");
				actions.className = "profile-post-actions";
				const like = document.createElement("button");
				like.type = "button";
				like.className = "profile-post-action";
				like.dataset.action = "like";
				like.setAttribute("aria-pressed", String(Boolean(post.liked)));
				like.innerHTML = `<span class="action-icon">${post.liked ? "♥" : "♡"}</span><span data-count>${post.likes || 0}</span>`;
				const share = document.createElement("button");
				share.type = "button";
				share.className = "profile-post-action";
				share.dataset.action = "share";
				share.innerHTML = "<span>↗</span><span>Share</span>";
				actions.append(like, share);
				const currentUser = window.UnisonAuth.getUser();
				if (currentUser && post.userId === currentUser.id) {
					const del = document.createElement("button");
					del.type = "button";
					del.className = "profile-post-action profile-post-delete";
					del.dataset.action = "delete";
					del.innerHTML = "<span>🗑</span><span>Delete</span>";
					actions.append(del);
				}
				card.append(actions);
				return card;
			}));
		} catch (error) {
			if (requestId !== profileRequestId) return;
			name.textContent = "Profile unavailable";
			posts.replaceChildren(Object.assign(document.createElement("p"), { className: "profile-posts-empty", textContent: error.message }));
		}
	}

	function conversationProfile(message, userId) {
		return message.sender_id === userId ? message.recipient : message.sender;
	}

	function showConversation(profile) {
		activeConversation = profile;
		messageRequestId += 1;
		document.querySelector("#message-thread-empty").hidden = true;
		document.querySelector("#message-thread-content").hidden = false;
		document.querySelector("#message-recipient-name").textContent = profile.display_name || "Unison member";
		document.querySelector("#message-recipient-handle").textContent = profile.handle ? `@${profile.handle}` : "@member";
		document.querySelector("#message-recipient-avatar").src = profile.avatar_url || fallbackAvatar;
	}

	async function refreshConversations() {
		if (!window.UnisonApi.isConfigured() || !window.UnisonAuth.getUser()) return;
		const list = document.querySelector("#conversation-list");
		const userId = window.UnisonAuth.getUser().id;
		const messages = await window.UnisonApi.listConversations();
		const conversations = new Map();
		messages.forEach((item) => {
			const profile = conversationProfile(item, userId);
			if (profile?.id && !conversations.has(profile.id)) conversations.set(profile.id, { profile, latest: item });
		});
		if (!conversations.size) {
			list.replaceChildren(Object.assign(document.createElement("p"), { className: "profile-posts-empty", textContent: "No messages yet. Visit a member profile and choose Message to start a conversation." }));
			return;
		}
		list.replaceChildren(...[...conversations.values()].map(({ profile, latest }) => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "conversation-item";
			button.classList.toggle("active", activeConversation?.id === profile.id);
			button.dataset.profileId = profile.id;
			button.dataset.profileName = profile.display_name || "Unison member";
			button.dataset.profileHandle = profile.handle ? `@${profile.handle}` : "@member";
			button.dataset.profileAvatar = profile.avatar_url || fallbackAvatar;
			const avatar = document.createElement("img");
			avatar.className = "avatar";
			avatar.src = profile.avatar_url || fallbackAvatar;
			avatar.alt = "";
			const copy = document.createElement("span");
			copy.className = "conversation-copy";
			const name = document.createElement("strong");
			name.textContent = profile.display_name || "Unison member";
			const preview = document.createElement("span");
			preview.textContent = latest.body;
			copy.append(name, preview);
			button.append(avatar, copy);
			return button;
		}));
	}

	async function refreshMessageHistory() {
		if (!activeConversation || !window.UnisonAuth.getUser()) return;
		const requestId = ++messageRequestId;
		const conversationId = activeConversation.id;
		const list = document.querySelector("#message-list");
		const messages = await window.UnisonApi.listMessages(conversationId);
		if (requestId !== messageRequestId || conversationId !== activeConversation?.id) return;
		const userId = window.UnisonAuth.getUser().id;
		list.replaceChildren(...messages.map((item) => {
			const bubble = document.createElement("article");
			bubble.className = `message-bubble ${item.sender_id === userId ? "sent" : "received"}`;
			const text = document.createElement("p");
			text.textContent = item.body;
			const time = document.createElement("time");
			time.dateTime = item.created_at;
			time.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at));
			bubble.append(text, time);
			return bubble;
		}));
		list.scrollTop = list.scrollHeight;
	}

	function startConversation(profile) {
		if (!requireSignedIn() || !profile?.id) return;
		showConversation(profile);
		setView("messages");
	}

	function addStoryCard({ image, name, avatar = "" }, { prepend = false } = {}) {
		const story = document.createElement("button");
		story.className = "story";
		story.type = "button";
		story.dataset.story = "";
		story.dataset.storyImage = image;
		story.style.backgroundImage = `url("${image}")`;
		const ring = document.createElement("span");
		ring.className = "story-ring";
		if (avatar) {
			const avatarImage = document.createElement("img");
			avatarImage.src = avatar;
			avatarImage.alt = "";
			ring.append(avatarImage);
		}
		const label = document.createElement("span");
		label.textContent = name;
		story.append(ring, label);
		const stories = document.querySelector(".stories");
		if (prepend) stories.insertBefore(story, stories.children[1] || null);
		else stories.append(story);
		return story;
	}

	async function refreshStories() {
		if (!window.UnisonApi.isConfigured()) return;
		const stories = await window.UnisonApi.listStories();
		document.querySelectorAll(".story[data-supabase-story]").forEach((story) => story.remove());
		stories.forEach((story) => {
			const card = addStoryCard(story, { prepend: true });
			card.dataset.supabaseStory = story.id;
			card.dataset.storyCaption = story.caption || "";
			if (story.avatar) {
				const avatar = document.createElement("img");
				avatar.src = story.avatar;
				avatar.alt = "";
				card.querySelector(".story-ring").append(avatar);
			}
		});
	}

	async function refreshSupabaseFeed() {
		const requestId = ++feedRequestId;
		if (!window.UnisonApi.isConfigured()) {
			feedPosts = currentView === "community" ? [] : [...window.UnisonData.posts];
			renderFeed();
			return;
		}
		if (!window.UnisonAuth.getUser() && currentView !== "community") {
			feedPosts = [...window.UnisonData.posts];
			renderFeed();
			return;
		}
		const scope = currentView === "townsquare" ? "townsquare" : currentView === "community" ? "community" : currentView === "saved" ? "saved" : currentFeed === "following" ? "following" : currentFeed === "mine" ? "mine" : "home";
		const results = await window.UnisonApi.listPosts({ scope, search: currentView === "search" ? "" : search.value.trim() });
		if (requestId !== feedRequestId) return;
		feedPosts = results;
		renderFeed();
	}

	function updatePrivateAccess() {
		const signedOut = !window.UnisonAuth.getUser();
		form.hidden = signedOut;
		document.querySelector("#home").classList.toggle("signed-out", signedOut);
		document.body.classList.toggle("signed-out", signedOut);
		document.body.classList.toggle("signed-in", !signedOut);
		document.querySelector(".app-shell").classList.toggle("signed-in", !signedOut);
		authGate.hidden = !signedOut;
		document.querySelector(".notification-menu-container").hidden = signedOut;
		feedRequestId += 1;
		feedPosts = signedOut ? [...window.UnisonData.posts] : [];
		renderFeed();
		if (signedOut) {
			activeConversation = null;
			messagesPage.hidden = true;
			document.querySelector("#message-list").replaceChildren();
			document.querySelector("#conversation-list").replaceChildren(Object.assign(document.createElement("p"), { className: "profile-posts-empty", textContent: "Sign in to view your conversations." }));
		}
	}

	renderFeed();
	const restoredUser = window.UnisonAuth.getUser();
	updateAccount(restoredUser);
	updatePrivateAccess();
	if (window.UnisonApi.isConfigured()) {
		if (restoredUser) {
			refreshStories().catch((error) => showToast(error.message));
			refreshPeople().catch((error) => showToast(error.message));
			refreshFriends().catch((error) => showToast(error.message));
			refreshSupabaseFeed().catch((error) => showToast(error.message));
			loadMyProfile().catch((error) => showToast(profileErrorMessage(error)));
			refreshGroupMemberships().catch((error) => showToast(error.message));
			refreshNotifications().catch((error) => showToast(error.message));
		}
	}

	function applyFilters() {
		const query = search.value.trim().toLowerCase();
		let visible = 0;
		feed.querySelectorAll(".post").forEach((post) => {
			const matchesSearch = !query || (post.dataset.search || "").toLowerCase().includes(query);
			const matchesView = currentView === "saved" ? post.classList.contains("saved") : currentView === "townsquare" ? post.dataset.local === "true" : currentView === "community" ? post.dataset.community === "true" : true;
			const matchesFollowing = currentFeed !== "following" || window.UnisonApi.isConfigured() || following.has(post.dataset.author);
			const userId = window.UnisonAuth.getUser()?.id;
			const matchesMine = currentFeed !== "mine" || (userId ? post.dataset.userId === userId : post.dataset.author === "@alexm");
			post.hidden = !(matchesSearch && matchesView && matchesFollowing && matchesMine);
			if (!post.hidden) visible += 1;
		});
		emptyState.style.display = (visible || ["explore", "watch", "events", "groups", "group"].includes(currentView)) ? "none" : "block";
	}

	function setView(view) {
		const allowedGuestViews = new Set(["home", "community", "explore", "townsquare", "events", "watch", "public-profile", "groups"]);
		if (!window.UnisonAuth.getUser() && !allowedGuestViews.has(view)) {
			if (view !== "home") openAuthDialog("Sign in to browse posts and community features.");
			return;
		}
		if (view === "my-profile" && !window.UnisonApi.isConfigured()) {
			showToast("Connect Supabase to manage your profile.");
			return;
		}
		if (currentView === "search" && view !== "search" && location.hash.startsWith("#search/")) {
			history.pushState({ view }, "", "#home");
			lastRouteHash = location.hash;
		}
		currentView = view;
		currentFeed = view === "my-posts" ? "mine" : "all";
		persistActiveView();
		viewTitle.textContent = view === "public-profile" ? "Member profile" : view === "account" ? "My account" : view === "settings" ? "Settings" : view === "messages" ? "Messages" : view === "search" ? "Search results" : view === "my-profile" ? "My Profile" : view === "my-posts" ? "My posts" : view === "saved" ? "Saved" : view === "explore" ? "Explore" : view === "townsquare" ? "Townsquare" : view === "community" ? "Community feed" : view === "notifications" ? "Notifications" : view === "watch" ? "Watch" : view === "pages" ? "Pages" : view === "events" ? "Events" : view === "groups" ? "Groups" : view === "group" ? "Group" : "Home";
		if (view === "community" || view === "explore" || view === "townsquare" || view === "watch" || view === "pages" || view === "events") {
			pageSubtitle.textContent = view === "community" ? "Public community posts are visible to everyone." : view === "explore" ? "Discover people, posts, and groups." : view === "townsquare" ? "Your neighborhood, one conversation at a time." : "Coming soon - check back later.";
		}
		if (!window.UnisonAuth.getUser()) {
			if (view === "community") {
				pageSubtitle.textContent = "Public community posts are visible to everyone.";
				authGate.querySelector("h2").textContent = "Public community feed";
				authGate.querySelector("p:not(.eyebrow)").textContent = "Community posts marked public can be viewed without an account. Sign in to post, like, or comment.";
			} else if (view === "explore") {
				pageSubtitle.textContent = "Discover people, posts, and groups.";
				authGate.querySelector("h2").textContent = "Explore";
				authGate.querySelector("p:not(.eyebrow)").textContent = "Browse public posts and discover people. Sign in to join the conversation.";
			} else if (view === "townsquare") {
				pageSubtitle.textContent = "Your neighborhood, one conversation at a time.";
				authGate.querySelector("h2").textContent = "Townsquare";
				authGate.querySelector("p:not(.eyebrow)").textContent = "Browse neighborhood updates. Sign in to post locally.";
			} else if (["watch", "events"].includes(view)) {
				pageSubtitle.textContent = "Coming soon.";
				authGate.querySelector("h2").textContent = view === "watch" ? "Watch" : "Events";
				authGate.querySelector("p:not(.eyebrow)").textContent = "This section is coming soon. Sign in to get notified when it's ready.";
			} else {
				authGate.querySelector("h2").textContent = "Take a look around";
				authGate.querySelector("p:not(.eyebrow)").textContent = "You’re viewing sample posts. Sign in or create an account to see members’ posts and join the conversation.";
			}
		}
		pageSubtitle.textContent = view === "search" ? `Posts matching “${search.value.trim()}”` : view === "my-profile" ? "Manage your picture and the information people see on your profile." : view === "my-posts" ? "Everything you have shared with your circle." : view === "townsquare" ? "Your neighborhood, one conversation at a time." : view === "community" ? "Posts shared with every signed-in member." : view === "explore" ? "Discover people, posts, and groups." : view === "watch" ? "Videos and shows from your circle." : view === "pages" ? "Pages from communities and creators." : view === "events" ? "Upcoming events near you." : view === "groups" ? "Join a group, follow the topics you care about, or start your own." : view === "group" ? activeGroup?.name || "Group home" : "Good things happen when we find each other.";
		if (view === "messages") pageSubtitle.textContent = "Private conversations between you and other members.";
		if (view === "public-profile") pageSubtitle.textContent = "Profile, background, and posts.";
		if (view === "settings") pageSubtitle.textContent = "Personalize how Unison looks.";
		if (view === "account") pageSubtitle.textContent = "Manage your sign-in email and handle.";
		if (view === "notifications") pageSubtitle.textContent = "Activity from people in your circle.";
		document.querySelector("#today-label").textContent = view === "settings" ? "MAKE UNISON YOURS" : view === "search" ? "SEARCH YOUR CIRCLE" : view === "my-profile" ? "YOUR PUBLIC PROFILE" : view === "community" ? "SHARED WITH THE COMMUNITY" : view === "notifications" ? "YOUR ACTIVITY" : "YOUR PEOPLE, YOUR PACE";
		if (view === "community") pageSubtitle.textContent = "Public community posts are visible to everyone.";
		document.querySelector("#home").classList.toggle("search-mode", view === "search");
		document.querySelector("#home").classList.toggle("profile-mode", view === "my-profile");
		document.querySelector("#home").classList.toggle("messages-mode", view === "messages");
		document.querySelector("#home").classList.toggle("settings-mode", view === "settings");
		document.querySelector("#home").classList.toggle("account-mode", view === "account");
		document.querySelector("#home").classList.toggle("public-profile-mode", view === "public-profile");
		document.querySelector("#my-profile-page").hidden = view !== "my-profile";
		publicProfilePage.hidden = view !== "public-profile";
		accountPage.hidden = view !== "account";
		messagesPage.hidden = view !== "messages";
		settingsPage.hidden = view !== "settings";
		document.querySelector("#notifications-page").hidden = view !== "notifications";
		document.querySelector("#home").classList.toggle("notifications-mode", view === "notifications");
		document.querySelector("#home").classList.toggle("groups-mode", view === "groups");
		document.querySelector("#home").classList.toggle("group-mode", view === "group");
		groupsPage.hidden = view !== "groups";
		groupPage.hidden = view !== "group";
		if (view === "account") {
			const user = window.UnisonAuth.getUser();
			document.querySelector("#account-email").value = user?.email || "";
			document.querySelector("#account-handle").value = currentProfile?.handle || "";
			if (!currentProfile) loadMyProfile().then((profile) => {
				if (profile && currentView === "account") document.querySelector("#account-handle").value = profile.handle || "";
			}).catch((error) => showToast(error.message));
		}
		if (["community", "explore", "townsquare"].includes(view) && !window.UnisonAuth.getUser()) {
			townSquareIntro.hidden = view !== "townsquare";
			const exploreIntro = document.querySelector("#explore-intro");
			if (exploreIntro) exploreIntro.hidden = view !== "explore";
			authGate.hidden = false;
		} else if (view === "home" && !window.UnisonAuth.getUser()) {
			townSquareIntro.hidden = true;
			const exploreIntro = document.querySelector("#explore-intro");
			if (exploreIntro) exploreIntro.hidden = true;
			authGate.hidden = false;
		} else {
			townSquareIntro.hidden = view !== "townsquare";
			const exploreIntro = document.querySelector("#explore-intro");
			if (exploreIntro) exploreIntro.hidden = view !== "explore";
			authGate.hidden = !(view === "home" && !window.UnisonAuth.getUser());
		}
		feedControls.hidden = view === "townsquare" || view === "community" || view === "explore" || view === "watch" || view === "pages" || view === "events" || view === "search" || view === "my-profile" || view === "messages" || view === "settings" || view === "account" || view === "public-profile" || view === "notifications" || view === "groups" || view === "group";
		input.placeholder = view === "townsquare" ? "Share something happening nearby..." : view === "community" ? "Share with the community..." : "What's on your mind, Alex?";
		postScope.value = view === "community" ? "community" : "home";
		document.querySelector("#post-destination").hidden = view === "townsquare" || view === "community";
		document.querySelector("#post-audience").hidden = view === "community";
		document.querySelectorAll("[data-view]").forEach((button) => {
			const active = button.dataset.view === view || (view === "group" && button.dataset.view === "groups");
			button.classList.toggle("active", active);
		});
		document.querySelectorAll("[data-filter]").forEach((button) => {
			const active = button.dataset.filter === (view === "my-posts" ? "mine" : "all");
			button.classList.toggle("active", active);
			button.setAttribute("aria-selected", String(active));
		});
		if (view === "explore") search.focus();
		applyFilters();
		if (view === "search") {
			refreshSearchPeople(search.value.trim()).catch((error) => showToast(error.message));
			refreshSearchGroups(search.value.trim()).catch((error) => showToast(error.message));
		}
		if (view === "my-profile") {
			if (!window.UnisonAuth.getUser()) {
				openAuthDialog("Sign in to view and edit your profile.");
				return;
			}
			loadMyProfile().catch((error) => showToast(profileErrorMessage(error)));
			return;
		}
		if (view === "messages") {
			refreshConversations().catch((error) => showToast(error.message));
			if (activeConversation) refreshMessageHistory().catch((error) => showToast(error.message));
			return;
		}
		if (view === "settings" || view === "account" || view === "public-profile") return;
		if (view === "notifications") {
			if (!window.UnisonAuth.getUser()) {
				openAuthDialog("Sign in to view notifications.");
				setView("home");
				return;
			}
			refreshNotifications().catch((error) => showToast(error.message));
			return;
		}
		if (view === "groups") {
			populateGroupCategories();
			renderGroupsHub().catch((error) => showToast(error.message));
			return;
		}
		if (view === "group") return;
		if (["watch", "events", "explore"].includes(view)) {
			feedPosts = [];
			renderFeed();
			applyFilters();
			return;
		}
		if (!window.UnisonAuth.getUser()) {
			if (view === "community") {
				refreshSupabaseFeed().catch(() => {
					feedPosts = [];
					renderFeed();
					applyFilters();
				});
			} else {
				feedPosts = [...window.UnisonData.posts];
				renderFeed();
				applyFilters();
			}
			return;
		}
		refreshSupabaseFeed().catch((error) => showToast(error.message));
	}

	function navigateToSearch(query, pushHistory = true) {
		const value = String(query || "").trim();
		if (!value) return showToast("Enter a name or keyword to search.");
		if (window.UnisonApi.isConfigured() && !window.UnisonAuth.getUser()) return openAuthDialog("Sign in to search posts, people, and groups.");
		search.value = value;
		if (pushHistory) history.pushState({ view: "search", query: value }, "", `#search/${encodeURIComponent(value)}`);
		lastRouteHash = location.hash;
		setView("search");
	}

	function restoreSearchRoute() {
		if (location.hash === lastRouteHash) return;
		lastRouteHash = location.hash;
		if (!location.hash.startsWith("#search/")) {
			if (currentView === "search") {
				search.value = "";
				setView("home");
			}
			return;
		}
		let query = "";
		try { query = decodeURIComponent(location.hash.slice("#search/".length)); } catch { query = ""; }
		if (query) navigateToSearch(query, false);
	}

	async function redeemPendingInvite() {
		const code = pendingInviteCode;
		pendingInviteCode = "";
		if (!code || !window.UnisonApi.isConfigured()) return;
		try {
			const groupId = await window.UnisonApi.joinGroupWithInvite(code);
			const id = typeof groupId === "string" ? groupId : String(groupId ?? "");
			showToast("You joined the group.");
			if (id) await openGroup(id);
		} catch (error) {
			showToast(error.message);
		}
	}

	function restoreInviteRoute() {
		if (!location.hash.startsWith("#invite/")) return;
		let code = "";
		try { code = decodeURIComponent(location.hash.slice("#invite/".length)); } catch { code = ""; }
		history.replaceState({ view: "groups" }, "", "#home");
		lastRouteHash = location.hash;
		if (!code) return;
		pendingInviteCode = code;
		if (!window.UnisonAuth.getUser()) {
			if (window.UnisonApi.isConfigured()) openAuthDialog("Sign in to accept this group invite.");
			return;
		}
		redeemPendingInvite();
	}

	function restoreSavedView() {
		if (location.hash.startsWith("#search/")) return;
		let saved;
		try { saved = JSON.parse(window.sessionStorage.getItem("unison.active-view") || "null"); } catch { saved = null; }
		const allowedViews = new Set(["home", "community", "my-posts", "my-profile", "messages", "explore", "townsquare", "saved", "settings", "account", "public-profile", "notifications", "search", "groups", "group"]);
		if (!allowedViews.has(saved?.view)) return;
		if (!window.UnisonAuth.getUser() && !["home", "community", "public-profile", "groups"].includes(saved.view)) {
			try { window.sessionStorage.removeItem("unison.active-view"); } catch { /* Ignore storage restrictions. */ }
			return;
		}
		if (saved.view === "public-profile") {
			if (saved.profileId || saved.profileHandle) openPublicProfile(saved.profileId, saved.profileHandle);
			return;
		}
		if (saved.view === "search") {
			if (saved.search) navigateToSearch(saved.search, false);
			return;
		}
		if (saved.view === "group") {
			if (saved.groupId) openGroup(saved.groupId);
			else setView("groups");
			return;
		}
		setView(saved.view);
		if (saved.view === "home" && ["all", "following", "mine"].includes(saved.feed) && saved.feed !== "all") {
			currentFeed = saved.feed;
			persistActiveView();
			document.querySelectorAll("[data-filter]").forEach((button) => {
				const active = button.dataset.filter === currentFeed;
				button.classList.toggle("active", active);
				button.setAttribute("aria-selected", String(active));
			});
			refreshSupabaseFeed().catch((error) => showToast(error.message));
		}
	}

	// 03. Navigation and feed controls
	function setAuthMode(createAccount) {
		signUpMode = createAccount;
		document.querySelector("#auth-title").textContent = createAccount ? "Create your account" : "Sign in";
		document.querySelector("#auth-submit").textContent = createAccount ? "Create account" : "Sign in";
		document.querySelector("#auth-mode-toggle").textContent = createAccount ? "Already have an account? Sign in" : "Create an account";
		document.querySelector("#auth-message").textContent = createAccount ? "Join your circle and share what matters." : "Sign in to post, like, save, and join groups.";
		document.querySelector("#auth-handle-field").hidden = !createAccount;
		document.querySelector("#auth-name-field").hidden = !createAccount;
		document.querySelector("#auth-handle").required = createAccount;
		document.querySelector("#auth-name").required = createAccount;
		const password = document.querySelector("#auth-password");
		password.autocomplete = createAccount ? "new-password" : "current-password";
		password.minLength = createAccount ? 8 : 0;
	}

	function closeAccountDropdown() {
		accountDropdown.hidden = true;
		accountButton.setAttribute("aria-expanded", "false");
	}
	accountButton.addEventListener("click", () => {
		const user = window.UnisonAuth.getUser();
		if (user) {
			document.querySelector("#account-dropdown-email").textContent = user.email || "Signed in";
			accountDropdown.hidden = !accountDropdown.hidden;
			accountButton.setAttribute("aria-expanded", String(!accountDropdown.hidden));
			return;
		}
		document.querySelector("#auth-email").closest(".dialog-field").hidden = false;
		document.querySelector("#auth-password").closest(".dialog-field").hidden = false;
		document.querySelector("#auth-submit").hidden = false;
		document.querySelector("#auth-mode-toggle").hidden = false;
		setAuthMode(false);
		openAuthDialog();
	});
	document.querySelector("#menu-account").addEventListener("click", () => { closeAccountDropdown(); setView("account"); });
	document.querySelector("#menu-settings").addEventListener("click", () => { closeAccountDropdown(); setView("settings"); });
	document.querySelector("#menu-signout").addEventListener("click", () => {
		closeAccountDropdown();
		document.querySelector("#auth-signout").click();
	});
	document.querySelector("#profile-handle-link").addEventListener("click", () => setView("account"));
	document.querySelector("#profile-display-name").addEventListener("input", renderMyProfilePreview);
	document.querySelector("#profile-bio").addEventListener("input", renderMyProfilePreview);
	document.querySelector("#account-handle-form").addEventListener("submit", async (event) => {
		event.preventDefault();
		const button = document.querySelector("#account-handle-save");
		const handle = document.querySelector("#account-handle").value.trim().replace(/^@/, "");
		if (!/^[A-Za-z0-9_]{2,24}$/.test(handle)) return showToast("Use 2–24 letters, numbers, or underscores for your handle.");
		button.disabled = true;
		button.textContent = "Saving…";
		try {
			currentProfile = await window.UnisonApi.updateMyHandle(handle);
			document.querySelector("#profile-handle-display").textContent = `@${currentProfile.handle}`;
			renderMyProfilePreview();
			updateAccount(window.UnisonAuth.getUser(), currentProfile);
			await Promise.all([refreshSupabaseFeed(), refreshPeople()]);
			showToast("Handle updated.");
		} catch (error) {
			showToast(profileErrorMessage(error));
		} finally {
			button.disabled = false;
			button.textContent = "Save handle";
		}
	});
	document.addEventListener("click", (event) => {
		if (!event.target.closest(".account-menu-container")) closeAccountDropdown();
	});
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") closeAccountDropdown();
	});
	document.querySelector("#gate-signin").addEventListener("click", () => openAuthDialog("Sign in to see the community feed."));
	document.querySelector("#gate-signup").addEventListener("click", () => {
		setAuthMode(true);
		openAuthDialog("Create an account to join the community feed.");
	});
	document.querySelector("#profile-avatar-file").addEventListener("change", (event) => {
		const file = event.currentTarget.files[0];
		if (!file) return;
		if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
			event.currentTarget.value = "";
			return showToast("Choose an image smaller than 5 MB.");
		}
		document.querySelector("#profile-avatar-preview").src = URL.createObjectURL(file);
		renderMyProfilePreview();
	});
	document.querySelector("#profile-background-file").addEventListener("change", (event) => {
		const file = event.currentTarget.files[0];
		if (!file) return;
		if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
			event.currentTarget.value = "";
			return showToast("Choose a background image smaller than 5 MB.");
		}
		setProfileCoverPreview(URL.createObjectURL(file));
	});
	document.querySelector("#profile-border").addEventListener("change", (event) => { applyProfileDecoration(document.querySelector("#profile-avatar-frame"), event.currentTarget.value, document.querySelector("#profile-sticker").value); renderMyProfilePreview(); });
	document.querySelector("#profile-sticker").addEventListener("change", (event) => { applyProfileDecoration(document.querySelector("#profile-avatar-frame"), document.querySelector("#profile-border").value, event.currentTarget.value); renderMyProfilePreview(); });
	document.querySelector("#profile-view-as-others").addEventListener("click", async (event) => {
		if (!requireSignedIn()) return;
		const button = event.currentTarget;
		button.disabled = true;
		try {
			const profile = currentProfile?.id ? currentProfile : await loadMyProfile();
			if (!profile?.id) throw new Error("Your profile is not ready yet. Try again in a moment.");
			await openPublicProfile(profile.id, profile.handle);
		} catch (error) {
			showToast(profileErrorMessage(error));
		} finally {
			button.disabled = false;
		}
	});
	document.querySelector("#profile-save").addEventListener("click", async (event) => {
		const button = event.currentTarget;
		const status = document.querySelector("#profile-save-status");
		const displayName = document.querySelector("#profile-display-name").value.trim();
		const bio = document.querySelector("#profile-bio").value.trim();
		const avatarBorder = document.querySelector("#profile-border").value;
		const profileSticker = document.querySelector("#profile-sticker").value;
		const photo = document.querySelector("#profile-avatar-file").files[0];
		const backgroundPhoto = document.querySelector("#profile-background-file").files[0];
		const handle = currentProfile?.handle || "member";
		if (!displayName) return showToast("Add a display name.");
		if (!/^[A-Za-z0-9_]{2,24}$/.test(handle)) return showToast("Use 2–24 letters, numbers, or underscores for your handle.");
		button.disabled = true;
		status.hidden = false;
		status.classList.remove("error");
		status.textContent = photo || backgroundPhoto ? "Uploading your photos…" : "Saving your profile…";
		button.textContent = "Saving…";
		try {
			let avatarUrl = currentProfile?.avatar_url || "";
			let backgroundUrl = currentProfile?.profile_background_url || "";
			if (photo) avatarUrl = await window.UnisonApi.uploadProfileImage(photo);
			if (backgroundPhoto) backgroundUrl = await window.UnisonApi.uploadProfileImage(backgroundPhoto);
			status.textContent = "Saving your profile…";
			const updatedProfile = await window.UnisonApi.updateMyProfile({ displayName, bio, avatarUrl, backgroundUrl, avatarBorder, profileSticker });
			if (!updatedProfile) throw new Error("Supabase did not return the updated profile. Check that your profile row exists and try again.");
			currentProfile = updatedProfile;
			updateAccount(window.UnisonAuth.getUser(), currentProfile);
			document.querySelector("#profile-avatar-preview").src = currentProfile.avatar_url || profileEditorAvatarPlaceholder;
			applyProfileDecoration(document.querySelector("#profile-avatar-frame"), currentProfile.avatar_border, currentProfile.profile_sticker);
			document.querySelector("#profile-avatar-file").value = "";
			document.querySelector("#profile-background-file").value = "";
			setProfileCoverPreview(currentProfile.profile_background_url || "");
			const profileUploads = [
				{ file: photo, label: "profile picture" },
				{ file: backgroundPhoto, label: "profile background" }
			].filter((upload) => upload.file);
			const shareResults = await Promise.allSettled(profileUploads.map(({ file, label }) => window.UnisonApi.createPost({
				text: `Updated their ${label}.`,
				scope: "home",
				visibility: "public",
				imageFile: file
			})));
			let sharedCount = 0;
			let shareError = null;
			shareResults.forEach((result) => {
				if (result.status === "fulfilled") {
					feedPosts.unshift(result.value);
					sharedCount += 1;
				} else shareError ||= result.reason;
			});
			if (sharedCount) renderFeed();
			status.classList.toggle("error", Boolean(shareError));
			status.textContent = shareError
				? `Profile saved, but ${sharedCount ? "some" : "the"} photo feed post${sharedCount === 1 ? "" : "s"} could not be created: ${shareError.message}`
				: sharedCount
					? `Profile saved. ${sharedCount} uploaded photo${sharedCount === 1 ? " was" : "s were"} shared to Home.`
					: "Your profile is saved.";
			showToast(shareError ? "Profile saved, but a photo could not be shared to Home." : sharedCount ? "Profile saved and shared to Home." : "Profile saved.");
			Promise.allSettled([refreshSupabaseFeed(), refreshPeople(), refreshFriends(), refreshStories()]).then((refreshResults) => {
				if (refreshResults.some((result) => result.status === "rejected")) showToast("Profile saved. Some profile pictures or posts may take a moment to refresh.");
			});
		} catch (error) {
			status.classList.add("error");
			status.textContent = profileErrorMessage(error);
			showToast(status.textContent);
		} finally {
			button.disabled = false;
			button.textContent = "Save profile";
		}
	});
	document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
	document.querySelector("#auth-password-toggle").addEventListener("click", (event) => {
		const password = document.querySelector("#auth-password");
		const visible = password.type === "password";
		password.type = visible ? "text" : "password";
		event.currentTarget.textContent = visible ? "Hide" : "Show";
		event.currentTarget.setAttribute("aria-pressed", String(visible));
	});
	authDialog.addEventListener("close", () => {
		document.querySelector("#auth-password").type = "password";
		const toggle = document.querySelector("#auth-password-toggle");
		toggle.textContent = "Show";
		toggle.setAttribute("aria-pressed", "false");
	});
	document.querySelector("#auth-mode-toggle").addEventListener("click", () => setAuthMode(!signUpMode));
	document.querySelector("#auth-form").addEventListener("submit", async (event) => {
		event.preventDefault();
		if (!window.UnisonApi.isConfigured()) return openAuthDialog();
		const submit = document.querySelector("#auth-submit");
		const message = document.querySelector("#auth-message");
		const credentials = {
			email: document.querySelector("#auth-email").value,
			password: document.querySelector("#auth-password").value
		};
		submit.disabled = true;
		submit.textContent = signUpMode ? "Creating account…" : "Signing in…";
		message.textContent = signUpMode ? "Creating your account securely…" : "Checking your sign-in…";
		try {
			if (signUpMode) {
				const result = await window.UnisonAuth.signUp({
					...credentials,
					handle: document.querySelector("#auth-handle").value.trim(),
					displayName: document.querySelector("#auth-name").value.trim()
				});
				if (result.needsEmailConfirmation) {
					setAuthMode(false);
					document.querySelector("#auth-password").value = "";
					document.querySelector("#auth-message").textContent = "Check your email for a confirmation link. Once confirmed, sign in with your email and password.";
					showToast("Confirmation email sent. Check your inbox, then sign in.");
					return;
				}
			} else {
				await window.UnisonAuth.signIn(credentials);
			}
			currentProfile = null;
			updatePrivateAccess();
			updateAccount(window.UnisonAuth.getUser(), null);
			authDialog.close();
			showToast("You are signed in.");
			Promise.allSettled([loadMyProfile(), refreshSupabaseFeed(), refreshGroupMemberships(), refreshStories(), refreshPeople(), refreshFriends(), refreshNotifications()]).then((results) => {
				if (results.some((result) => result.status === "rejected")) showToast("You are signed in, but some profile or feed data could not load.");
			});
			if (pendingInviteCode) redeemPendingInvite();
		} catch (error) {
			message.textContent = error.message || "We couldn’t sign you in. Check your details and try again.";
			showToast(error.message);
		} finally {
			submit.disabled = false;
			submit.textContent = signUpMode ? "Create account" : "Sign in";
		}
	});
	document.querySelector("#auth-signout").addEventListener("click", async () => {
		try {
			await window.UnisonAuth.signOut();
			currentProfile = null;
			updateAccount(null);
			updatePrivateAccess();
			document.querySelector("#auth-email").closest(".dialog-field").hidden = false;
			document.querySelector("#auth-password").closest(".dialog-field").hidden = false;
			document.querySelector("#auth-submit").hidden = false;
			document.querySelector("#auth-mode-toggle").hidden = false;
			setAuthMode(false);
			authDialog.close();
			setView("home");
			showToast("You are signed out.");
		} catch (error) {
			showToast(error.message);
		}
	});

	document.querySelector("[data-attach-photo]").addEventListener("click", () => photoInput.click());
	photoInput.addEventListener("change", () => {
		selectedPhoto = photoInput.files[0] || null;
		const preview = document.querySelector("#photo-preview");
		preview.hidden = !selectedPhoto;
		if (selectedPhoto) document.querySelector("#photo-preview-image").src = URL.createObjectURL(selectedPhoto);
	});
	document.querySelector("[data-remove-photo]").addEventListener("click", () => {
		selectedPhoto = null;
		photoInput.value = "";
		document.querySelector("#photo-preview").hidden = true;
	});
	document.querySelector("[data-open-feelings]").addEventListener("click", (event) => {
		const menu = document.querySelector("#feeling-menu");
		menu.hidden = !menu.hidden;
		event.currentTarget.setAttribute("aria-expanded", String(!menu.hidden));
	});
	document.querySelectorAll("[data-feeling]").forEach((button) => button.addEventListener("click", () => {
		input.value = `${input.value.trim()} ${button.dataset.feeling}`.trim();
		document.querySelector("#feeling-menu").hidden = true;
		document.querySelector("[data-open-feelings]").setAttribute("aria-expanded", "false");
		input.focus();
	}));
	document.querySelector("[data-create-story]").addEventListener("click", () => storyInput.click());
	// Community posts are public only, so hide the audience choice when targeting the community feed.
	postScope.addEventListener("change", () => {
		document.querySelector("#post-audience").hidden = postScope.value === "community";
	});
	storyInput.addEventListener("change", async () => {
		const imageFile = storyInput.files[0];
		if (!imageFile) return;
		if (window.UnisonApi.isConfigured() && !requireSignedIn()) return;
		try {
			const story = window.UnisonApi.isConfigured()
				? await window.UnisonApi.createStory({ imageFile })
				: { image: URL.createObjectURL(imageFile), name: "Your story" };
			addStoryCard(story, { prepend: true });
			showToast("Story added for this session.");
		} catch (error) {
			showToast(error.message);
		} finally {
			storyInput.value = "";
		}
	});
	document.querySelector(".stories").addEventListener("click", (event) => {
		const story = event.target.closest("[data-story]");
		if (!story) return;
		const background = story.dataset.storyImage || getComputedStyle(story).backgroundImage;
		const imageUrl = background.match(/url\(["']?(.*?)["']?\)/)?.[1];
		if (!imageUrl) return;
		document.querySelector("#story-image").src = imageUrl;
		document.querySelector("#story-title").textContent = story.querySelector(":scope > span:last-child").textContent;
		storyDialog.showModal();
	});

	const contactSearch = document.querySelector("#contact-search");
	document.querySelector("#contact-search-toggle").addEventListener("click", (event) => {
		contactSearch.hidden = !contactSearch.hidden;
		event.currentTarget.setAttribute("aria-expanded", String(!contactSearch.hidden));
		if (!contactSearch.hidden) contactSearch.focus();
	});
	contactSearch.addEventListener("input", () => {
		const query = contactSearch.value.trim().toLowerCase();
		document.querySelectorAll(".contact-list .contact").forEach((contact) => {
			contact.hidden = !contact.textContent.toLowerCase().includes(query);
		});
	});
	document.querySelector("#contact-list").addEventListener("click", async (event) => {
		const button = event.target.closest("button.follow");
		if (!button) return;
		const isFollowing = button.getAttribute("aria-pressed") === "true";
		if (window.UnisonApi.isConfigured() && !requireSignedIn()) return;
		try {
			if (window.UnisonApi.isConfigured()) await window.UnisonApi.toggleFollow(button.dataset.followId, !isFollowing);
			else if (isFollowing) following.delete(button.dataset.followId);
			else following.add(button.dataset.followId);
			button.setAttribute("aria-pressed", String(!isFollowing));
			button.textContent = !isFollowing ? "Following" : "Follow";
			await refreshFriends();
		} catch (error) {
			showToast(error.message);
		}
	});
	const createGroupBtn = document.querySelector("#create-group-btn");
	const groupsCreateBtn = document.querySelector("#groups-create-btn");
	function openGroupDialog() {
		if (!requireSignedIn()) return;
		if (!window.UnisonApi.isConfigured()) { showToast("Connect Supabase to create groups."); return; }
		populateGroupCategories();
		if (groupDialog && !groupDialog.open) groupDialog.showModal();
	}
	if (createGroupBtn) createGroupBtn.addEventListener("click", openGroupDialog);
	if (groupsCreateBtn) groupsCreateBtn.addEventListener("click", openGroupDialog);
	if (groupForm) {
		groupForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			if (!requireSignedIn()) return;
			const nameInput = document.querySelector("#group-name");
			const descInput = document.querySelector("#group-description");
			const categoryInput = document.querySelector("#group-category");
			const privacyInput = document.querySelector("#group-privacy");
			const avatarInput = document.querySelector("#group-avatar-file");
			const coverInput = document.querySelector("#group-cover-file");
			try {
				await window.UnisonApi.createGroup({
					name: nameInput?.value || "",
					description: descInput?.value || "",
					category: categoryInput?.value || "General",
					privacy: privacyInput?.value || "public",
					avatarFile: avatarInput?.files?.[0] || null,
					coverFile: coverInput?.files?.[0] || null
				});
				showToast("Group created.");
				if (groupDialog) groupDialog.close();
				if (nameInput) nameInput.value = "";
				if (descInput) descInput.value = "";
				if (avatarInput) avatarInput.value = "";
				if (coverInput) coverInput.value = "";
				await refreshGroupMemberships();
				if (currentView === "groups") await renderGroupsHub();
			} catch (error) {
				showToast(error.message);
			}
		});
	}

	// 05b. Groups hub, group page, and moderation handlers
	const groupsSearch = document.querySelector("#groups-search");
	const groupsCategoryFilter = document.querySelector("#groups-category-filter");
	let groupsFilterTimer = 0;
	if (groupsSearch) groupsSearch.addEventListener("input", () => {
		clearTimeout(groupsFilterTimer);
		groupsFilterTimer = window.setTimeout(() => renderGroupsHub().catch((error) => showToast(error.message)), 250);
	});
	if (groupsCategoryFilter) groupsCategoryFilter.addEventListener("change", () => renderGroupsHub().catch((error) => showToast(error.message)));
	document.querySelector("#group-page-back").addEventListener("click", () => setView("groups"));
	document.addEventListener("click", async (event) => {
		const joinButton = event.target.closest("button[data-group-id]");
		if (joinButton) {
			const shouldJoin = joinButton.getAttribute("aria-pressed") !== "true";
			if (window.UnisonApi.isConfigured() && !requireSignedIn()) return;
			try {
				if (window.UnisonApi.isConfigured()) {
					if (shouldJoin) {
						const status = await window.UnisonApi.joinGroup(joinButton.dataset.groupId);
						showToast(status === "pending" ? "Join request sent for approval." : "You joined the group.");
					} else {
						await window.UnisonApi.leaveGroup(joinButton.dataset.groupId);
						showToast("You left the group.");
					}
				} else if (shouldJoin) demoJoinedGroups.add(joinButton.dataset.groupId);
				else demoJoinedGroups.delete(joinButton.dataset.groupId);
				await refreshGroupMemberships();
				if (window.UnisonApi.isConfigured() && activeGroupId === joinButton.dataset.groupId && currentView === "group") await openGroup(activeGroupId);
			} catch (error) {
				showToast(error.message);
			}
			return;
		}
		const card = event.target.closest("[data-open-group]");
		if (card) openGroup(card.dataset.openGroup);
	});
	document.querySelector("#group-join").addEventListener("click", async () => {
		if (!activeGroupId) return;
		try {
			const status = await window.UnisonApi.joinGroup(activeGroupId);
			showToast(status === "pending" ? "Join request sent for approval." : "You joined the group.");
			await openGroup(activeGroupId);
		} catch (error) {
			showToast(error.message);
		}
	});
	document.querySelector("#group-manage-toggle").addEventListener("click", () => {
		const admin = document.querySelector("#group-admin");
		admin.hidden = !admin.hidden;
		document.querySelector("#group-manage-toggle").textContent = admin.hidden ? "Manage" : "Hide management";
	});
	document.querySelector("#group-invite-copy").addEventListener("click", async () => {
		const link = document.querySelector("#group-invite-link").value;
		if (!link) return showToast("Generate a link first.");
		try {
			await navigator.clipboard.writeText(link);
			showToast("Invite link copied.");
		} catch {
			showToast("Copy the invite link manually.");
		}
	});
	document.querySelector("#group-invite-regenerate").addEventListener("click", async () => {
		if (!activeGroupId) return;
		try {
			const code = await window.UnisonApi.regenerateInviteCode(activeGroupId);
			activeGroup.invite_code = code;
			const link = document.querySelector("#group-invite-link");
			link.value = `${location.origin}${location.pathname}#invite/${code}`;
			link.placeholder = "";
			showToast("New invite link ready.");
		} catch (error) {
			showToast(error.message);
		}
	});
	document.querySelector("#group-admin").addEventListener("click", async (event) => {
		const button = event.target.closest("button[data-member-action]");
		if (!button || !activeGroupId) return;
		const row = button.closest("[data-member-id]");
		const userId = row?.dataset.memberId;
		if (!userId) return;
		button.disabled = true;
		try {
			switch (button.dataset.memberAction) {
				case "approve":
					await window.UnisonApi.setGroupMemberStatus(activeGroupId, userId, "approved");
					showToast("Member approved.");
					break;
				case "decline":
					await window.UnisonApi.removeGroupMember(activeGroupId, userId);
					showToast("Request declined.");
					break;
				case "promote":
					await window.UnisonApi.setGroupMemberRole(activeGroupId, userId, "admin");
					showToast("Member is now an admin.");
					break;
				case "demote":
					await window.UnisonApi.setGroupMemberRole(activeGroupId, userId, "member");
					showToast("Admin access removed.");
					break;
				case "remove":
					await window.UnisonApi.removeGroupMember(activeGroupId, userId);
					showToast("Member removed.");
					break;
			}
			groupMembers = await window.UnisonApi.listGroupMembers(activeGroupId).catch(() => groupMembers);
			renderGroupMembers();
			renderGroupDetail();
		} catch (error) {
			showToast(error.message);
		} finally {
			button.disabled = false;
		}
	});
	document.querySelector("#group-photo-input").addEventListener("change", () => {
		const file = document.querySelector("#group-photo-input").files?.[0];
		const preview = document.querySelector("#group-photo-preview");
		const image = document.querySelector("#group-photo-preview-image");
		if (!file) { preview.hidden = true; return; }
		image.src = URL.createObjectURL(file);
		preview.hidden = false;
	});
	document.querySelector("#group-post-form").addEventListener("click", (event) => {
		if (event.target.closest("[data-group-photo]")) document.querySelector("#group-photo-input").click();
		if (event.target.closest("[data-remove-group-photo]")) {
			document.querySelector("#group-photo-input").value = "";
			document.querySelector("#group-photo-preview").hidden = true;
		}
	});
	document.querySelector("#group-post-form").addEventListener("submit", async (event) => {
		event.preventDefault();
		if (!activeGroupId) return;
		const textarea = document.querySelector("#group-post-text");
		const photo = document.querySelector("#group-photo-input").files?.[0] || null;
		const status = document.querySelector("#group-post-status");
		try {
			await window.UnisonApi.createPost({ text: textarea.value, scope: "group", visibility: "public", imageFile: photo, groupId: activeGroupId });
			textarea.value = "";
			document.querySelector("#group-photo-input").value = "";
			document.querySelector("#group-photo-preview").hidden = true;
			status.hidden = true;
			showToast("Posted to the group.");
			await refreshGroupFeed();
		} catch (error) {
			status.hidden = false;
			status.textContent = error.message;
		}
	});
	document.querySelectorAll("[data-coming-soon]").forEach((button) => button.addEventListener("click", () => showToast("That section is not available yet.")));
	document.querySelectorAll("[data-scroll-to]").forEach((button) => button.addEventListener("click", () => {
		document.querySelector(`#${button.dataset.scrollTo}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
	}));
	document.querySelector("#brand-home").addEventListener("click", (event) => {
		event.preventDefault();
		setView("home");
		if (location.hash !== "#home") {
			history.pushState({ view: "home" }, "", "#home");
			lastRouteHash = location.hash;
		}
		window.scrollTo({ top: 0, behavior: "smooth" });
	});
	document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
	document.querySelector("#notifications-button").addEventListener("click", async () => {
		const dropdown = document.querySelector("#notifications-dropdown");
		const isOpen = !dropdown.hidden;
		closeAccountDropdown();
		if (isOpen) {
			dropdown.hidden = true;
			document.querySelector("#notifications-button").setAttribute("aria-expanded", "false");
			return;
		}
		if (!window.UnisonAuth.getUser()) return openAuthDialog("Sign in to view notifications.");
		dropdown.hidden = false;
		document.querySelector("#notifications-button").setAttribute("aria-expanded", "true");
		await refreshNotifications();
	});
	document.addEventListener("click", (event) => {
		if (event.target.closest("#notifications-button")) return;
		const dropdown = document.querySelector("#notifications-dropdown");
		if (!dropdown.hidden) { dropdown.hidden = true; document.querySelector("#notifications-button").setAttribute("aria-expanded", "false"); }
	});
	document.querySelector("#notifications-dropdown-mark-all").addEventListener("click", async (event) => {
		event.stopPropagation();
		await markAllNotificationsRead();
		document.querySelector("#notifications-dropdown").hidden = true;
		document.querySelector("#notifications-button").setAttribute("aria-expanded", "false");
	});
	document.querySelector("#notifications-page #mark-all-notifications-read").addEventListener("click", async () => {
		await markAllNotificationsRead();
		await refreshNotifications();
	});
	async function handleNotificationListClick(event) {
		const deleteButton = event.target.closest("[data-delete-notification]");
		if (deleteButton) {
			event.stopPropagation();
			await deleteNotification(deleteButton.dataset.deleteNotification);
			return;
		}
		const item = event.target.closest(".notification-item");
		if (item && !item.classList.contains("unread")) return;
		if (item) {
			event.stopPropagation();
			await markNotificationRead(item.dataset.notificationId);
		}
	}
	document.querySelector("#notifications-dropdown").addEventListener("click", handleNotificationListClick);
	document.querySelector("#notifications-page-list").addEventListener("click", handleNotificationListClick);
	document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
		currentView = "home";
		currentFeed = button.dataset.filter;
		viewTitle.textContent = currentFeed === "following" ? "Your people, first." : currentFeed === "mine" ? "My posts" : "Your circle, in sync.";
		persistActiveView();
		document.querySelectorAll("[data-filter]").forEach((item) => {
			const active = item.dataset.filter === currentFeed;
			item.classList.toggle("active", active);
			item.setAttribute("aria-selected", String(active));
		});
		applyFilters();
		if (currentFeed === "mine" && window.UnisonApi.isConfigured() && !window.UnisonAuth.getUser()) {
			openAuthDialog("Sign in to see your posts.");
			return;
		}
		refreshSupabaseFeed().catch((error) => showToast(error.message));
	}));
	document.querySelectorAll("[data-focus-composer]").forEach((button) => button.addEventListener("click", () => {
		if (!window.UnisonAuth.getUser()) {
			openAuthDialog("Sign in to create a post.");
			return;
		}
		input.focus();
		document.querySelector(".composer").scrollIntoView({ behavior: "smooth", block: "center" });
	}));
	document.querySelector("#people-list").addEventListener("click", async (event) => {
		const profileLink = event.target.closest(".person-profile-link");
		if (profileLink) {
			openPublicProfile(profileLink.dataset.profileId, profileLink.dataset.profileHandle);
			return;
		}
		const button = event.target.closest("button.follow");
		if (!button) {
			const person = event.target.closest(".person");
			if (person) openPublicProfile(person.dataset.profileId, person.dataset.profileHandle || person.querySelector(".person-handle")?.textContent || "");
			return;
		}
		const isFollowing = button.getAttribute("aria-pressed") === "true";
		if (window.UnisonApi.isConfigured()) {
			if (!requireSignedIn()) return;
			if (!button.dataset.followId) return showToast("Demo profiles are not in your Supabase project.");
			try {
				await window.UnisonApi.toggleFollow(button.dataset.followId, !isFollowing);
				if (!isFollowing) await createActivityNotification({ recipientId: button.dataset.followId, type: "follow", entityType: "profile", entityId: button.dataset.followId });
			} catch (error) {
				return showToast(error.message);
			}
		} else {
			const handle = button.dataset.followHandle;
			if (isFollowing) following.delete(handle);
			else following.add(handle);
		}
		setFollowButton(button, !isFollowing);
		applyFilters();
	});
	document.querySelector("#public-profile-follow").addEventListener("click", async (event) => {
		const button = event.currentTarget;
		if (!requireSignedIn()) return;
		const followingProfile = button.getAttribute("aria-pressed") === "true";
		try {
			await window.UnisonApi.toggleFollow(button.dataset.followId, !followingProfile);
			if (!followingProfile) await createActivityNotification({ recipientId: button.dataset.followId, type: "follow", entityType: "profile", entityId: button.dataset.followId });
			setFollowButton(button, !followingProfile);
			await refreshPeople();
		} catch (error) {
			showToast(error.message);
		}
	});
	document.querySelector("#public-profile-message").addEventListener("click", (event) => {
		const button = event.currentTarget;
		startConversation({
			id: button.dataset.profileId,
			display_name: button.dataset.profileName,
			handle: button.dataset.profileHandle,
			avatar_url: button.dataset.profileAvatar
		});
	});
	document.querySelector("#profile-page-back").addEventListener("click", () => {
		setView(previousProfileReturnView === "public-profile" ? "home" : previousProfileReturnView);
		window.scrollTo(0, previousProfileReturnScrollY);
	});
	document.querySelector("#messages-refresh").addEventListener("click", () => {
		refreshConversations().catch((error) => showToast(error.message));
		if (activeConversation) refreshMessageHistory().catch((error) => showToast(error.message));
	});
	document.querySelector("#conversation-list").addEventListener("click", (event) => {
		const button = event.target.closest("button[data-profile-id]");
		if (!button) return;
		showConversation({
			id: button.dataset.profileId,
			display_name: button.dataset.profileName,
			handle: button.dataset.profileHandle,
			avatar_url: button.dataset.profileAvatar
		});
		refreshConversations().catch((error) => showToast(error.message));
		refreshMessageHistory().catch((error) => showToast(error.message));
	});
	messageForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (!requireSignedIn() || !activeConversation) return;
		const messageInput = document.querySelector("#message-input");
		const sendButton = messageForm.querySelector("button[type='submit']");
		const text = messageInput.value.trim();
		if (!text) return;
		sendButton.disabled = true;
		try {
			await window.UnisonApi.sendMessage(activeConversation.id, text);
			messageInput.value = "";
			await Promise.all([refreshMessageHistory(), refreshConversations()]);
		} catch (error) {
			showToast(error.message);
		} finally {
			sendButton.disabled = false;
		}
	});
	document.querySelectorAll("[data-topic]").forEach((button) => button.addEventListener("click", () => {
		search.value = button.dataset.topic;
		setView("explore");
		applyFilters();
	}));
	search.addEventListener("input", applyFilters);
	searchForm.addEventListener("submit", (event) => {
		event.preventDefault();
		navigateToSearch(search.value);
	});
	document.querySelector("#search-people-list").addEventListener("click", (event) => {
		const person = event.target.closest(".search-person-profile");
		if (person) openPublicProfile(person.dataset.profileId, person.dataset.profileHandle);
	});
	window.addEventListener("popstate", () => { restoreSearchRoute(); restoreInviteRoute(); });
	window.addEventListener("hashchange", () => { restoreSearchRoute(); restoreInviteRoute(); });
	restoreSearchRoute();
	restoreInviteRoute();
	restoreSavedView();

	function postDataForElement(postElement, posts = feedPosts) {
		if (!postElement) return undefined;
		return posts.find((post) => post.id
			? post.id === postElement.dataset.postId
			: post.handle === postElement.dataset.author);
	}

	function renderComments(comments) {
		const list = document.querySelector("#comments-list");
		list.replaceChildren();
		if (!comments.length) {
			const empty = document.createElement("p");
			empty.className = "dialog-copy";
			empty.textContent = "No replies yet. Start the conversation.";
			list.append(empty);
			return;
		}
		comments.forEach((comment) => {
			const item = document.createElement("div");
			item.className = "comment-item";
			const author = document.createElement("strong");
			author.textContent = comment.profiles?.display_name || comment.author || "Unison member";
			const text = document.createElement("span");
			text.textContent = comment.body;
			item.append(author, text);
			const signedInUser = window.UnisonAuth.getUser();
			const canDelete = Boolean(comment.id && signedInUser && (
				comment.user_id === signedInUser.id || activeCommentPost?.dataset.userId === signedInUser.id
			));
			if (canDelete) {
				const remove = document.createElement("button");
				remove.className = "comment-delete";
				remove.type = "button";
				remove.dataset.deleteComment = comment.id;
				remove.textContent = "Delete";
				remove.setAttribute("aria-label", "Delete this comment");
				item.append(remove);
			}
			list.append(item);
		});
	}

	async function openComments(postElement) {
		activeCommentPost = postElement;
		const postData = postDataForElement(postElement);
		if (window.UnisonApi.isConfigured() && !postElement.dataset.postId) {
			showToast("This sample post is not on your Supabase backend.");
			return;
		}
		document.querySelector("#comments-title").textContent = `Replies to ${postElement.querySelector(".post-name").textContent}`;
		commentsDialog.showModal();
		try {
			const comments = window.UnisonApi.isConfigured() && postElement.dataset.postId
				? await window.UnisonApi.listComments(postElement.dataset.postId)
				: demoComments.get(postElement.dataset.postId || postData?.handle) || [];
			renderComments(comments);
		} catch (error) {
			showToast(error.message);
		}
	}

	document.querySelector("#comments-list").addEventListener("click", async (event) => {
		const button = event.target.closest("[data-delete-comment]");
		if (!button || !activeCommentPost || !requireSignedIn()) return;
		if (!window.UnisonApi.isConfigured() || !activeCommentPost.dataset.postId) return showToast("This sample comment cannot be deleted.");
		if (!window.confirm("Delete this comment? This cannot be undone.")) return;
		button.disabled = true;
		try {
			await window.UnisonApi.deleteComment(button.dataset.deleteComment);
			const comments = await window.UnisonApi.listComments(activeCommentPost.dataset.postId);
			const postData = postDataForElement(activeCommentPost);
			if (postData) postData.replies = comments.length;
			activeCommentPost.querySelector('[data-field="replies"]').textContent = `${comments.length} replies`;
			renderComments(comments);
			showToast("Comment deleted.");
		} catch (error) {
			showToast(error.message);
		} finally {
			button.disabled = false;
		}
	});

	// 04. Post actions and composer
	async function handlePostActions(event, posts, container) {
		const profileLink = event.target.closest("[data-profile-link]");
		if (profileLink) {
			await openPublicProfile(profileLink.dataset.profileId, profileLink.dataset.profileHandle);
			return;
		}
		const ownerAction = event.target.closest("[data-owner-action]");
		if (ownerAction) {
			const post = ownerAction.closest(".post");
			const menu = ownerAction.closest("[data-owner-menu]");
			if (menu) menu.hidden = true;
			const postData = postDataForElement(post, posts);
			const isOwner = Boolean(post && window.UnisonAuth.getUser() && post.dataset.userId === window.UnisonAuth.getUser()?.id);
			if (ownerAction.dataset.ownerAction === "pin") {
				if (!postData?.canModerate) return showToast("Only group admins can pin posts.");
				if (!post.dataset.postId || !window.UnisonApi.isConfigured()) return showToast("This post cannot be pinned.");
				ownerAction.disabled = true;
				try {
					const next = !postData.pinned;
					await window.UnisonApi.setPostPinned(post.dataset.postId, next);
					postData.pinned = next;
					ownerAction.textContent = next ? "Unpin post" : "Pin post";
					const badge = post.querySelector('[data-field="pinned-badge"]');
					post.classList.toggle("pinned", next);
					if (badge) badge.hidden = !next;
					if (container === groupFeed) renderGroupFeed();
					showToast(next ? "Post pinned." : "Post unpinned.");
				} catch (error) {
					showToast(error.message);
				} finally {
					ownerAction.disabled = false;
				}
				return;
			}
			if (!isOwner) return showToast("You can only manage your own posts.");
			if (ownerAction.dataset.ownerAction !== "delete") return;
			if (!post.dataset.postId || !window.UnisonApi.isConfigured()) return showToast("Only your saved posts can be deleted.");
			if (!window.confirm("Delete this post? This cannot be undone.")) return;
			ownerAction.disabled = true;
			try {
				await window.UnisonApi.deletePost(post.dataset.postId);
				const index = posts.indexOf(postData);
				if (index >= 0) posts.splice(index, 1);
				post.remove();
				if (container === feed) applyFilters();
				showToast("Post deleted.");
			} catch (error) {
				showToast(error.message);
			} finally {
				ownerAction.disabled = false;
			}
			return;
		}
		const button = event.target.closest("button[data-action]");
		if (!button) return;
		const post = button.closest(".post");
		const postData = postDataForElement(post, posts);
		if (button.dataset.action === "like") {
			const liked = button.getAttribute("aria-pressed") === "true";
			if (window.UnisonApi.isConfigured()) {
				if (!requireSignedIn()) return;
				if (!post.dataset.postId) return showToast("This sample post is not on your Supabase backend.");
				try {
					await window.UnisonApi.likePost(post.dataset.postId, !liked);
				} catch (error) {
					return showToast(error.message);
				}
				await createActivityNotification({ recipientId: postData.userId, type: "like", entityType: "post", entityId: post.dataset.postId });
			}
			if (postData) {
				postData.liked = !liked;
				postData.likes = Math.max(0, (postData.likes || 0) + (liked ? -1 : 1));
			}
			button.setAttribute("aria-pressed", String(!liked));
			button.classList.toggle("liked", !liked);
			button.querySelector(".action-icon").textContent = liked ? "♡" : "♥";
			button.querySelector("[data-count]").textContent = String(postData?.likes ?? Number(button.querySelector("[data-count]").textContent) + (liked ? -1 : 1));
			button.querySelector("[data-label]").textContent = liked ? "Like" : "Liked";
		} else if (button.dataset.action === "save") {
			const saved = button.getAttribute("aria-pressed") === "true";
			if (window.UnisonApi.isConfigured()) {
				if (!requireSignedIn()) return;
				if (!post.dataset.postId) return showToast("This sample post is not on your Supabase backend.");
				try {
					await window.UnisonApi.savePost(post.dataset.postId, !saved);
				} catch (error) {
					return showToast(error.message);
				}
			}
			post.classList.toggle("saved", !saved);
			button.setAttribute("aria-pressed", String(!saved));
			button.classList.toggle("saved", !saved);
			button.querySelector("[data-label]").textContent = saved ? "Save" : "Saved";
			if (postData) postData.saved = !saved;
			showToast(!saved ? "Added to saved posts" : "Removed from saved posts");
			if (currentView === "saved") applyFilters();
		} else if (button.dataset.action === "reply") {
			await openComments(post);
		} else if (button.dataset.action === "share") {
			try {
				await navigator.clipboard.writeText(window.location.href);
				showToast("Page link copied");
			} catch {
				showToast("Copy the page address to share this post.");
			}
		} else if (button.dataset.action === "menu") {
			const menu = post.querySelector("[data-owner-menu]");
			const expanded = button.getAttribute("aria-expanded") === "true";
			container.querySelectorAll("[data-owner-menu]").forEach((item) => { item.hidden = true; });
			container.querySelectorAll('.post-menu[data-action="menu"]').forEach((item) => item.setAttribute("aria-expanded", "false"));
			menu.hidden = expanded;
			button.setAttribute("aria-expanded", String(!expanded));
		}
	}

	feed.addEventListener("click", (event) => handlePostActions(event, feedPosts, feed));
	if (groupFeed) groupFeed.addEventListener("click", (event) => handlePostActions(event, groupPosts, groupFeed));

	document.querySelector("#public-profile-posts").addEventListener("click", async (event) => {
		const profileLink = event.target.closest("[data-profile-link]");
		if (profileLink) {
			await openPublicProfile(profileLink.dataset.profileId, profileLink.dataset.profileHandle);
			return;
		}
		const button = event.target.closest("button[data-action]");
		if (!button) return;
		const card = button.closest(".profile-post-card");
		if (!card) return;
		const postId = card.dataset.postId;
		const userId = card.dataset.userId;
		const currentUser = window.UnisonAuth.getUser();
		if (button.dataset.action === "like") {
			const liked = button.getAttribute("aria-pressed") === "true";
			if (window.UnisonApi.isConfigured()) {
				if (!requireSignedIn()) return;
				if (!postId) return showToast("This post is not on your Supabase backend.");
				try {
					await window.UnisonApi.likePost(postId, !liked);
				} catch (error) {
					return showToast(error.message);
				}
				await createActivityNotification({ recipientId: userId, type: "like", entityType: "post", entityId: postId });
			}
			button.setAttribute("aria-pressed", String(!liked));
			button.classList.toggle("liked", !liked);
			const icon = button.querySelector(".action-icon");
			if (icon) icon.textContent = liked ? "♡" : "♥";
			const count = button.querySelector("[data-count]");
			if (count) count.textContent = String(Math.max(0, Number(count.textContent || 0) + (liked ? -1 : 1)));
		} else if (button.dataset.action === "share") {
			try {
				await navigator.clipboard.writeText(window.location.href);
				showToast("Page link copied");
			} catch {
				showToast("Copy the page address to share this post.");
			}
		} else if (button.dataset.action === "delete") {
			if (!currentUser || userId !== currentUser.id) return showToast("You can only delete your own posts.");
			if (!postId || !window.UnisonApi.isConfigured()) return showToast("Only your saved posts can be deleted.");
			if (!window.confirm("Delete this post? This cannot be undone.")) return;
			button.disabled = true;
			try {
				await window.UnisonApi.deletePost(postId);
				card.remove();
				showToast("Post deleted.");
				await refreshNotifications();
			} catch (error) {
				showToast(error.message);
			} finally {
				button.disabled = false;
			}
		}
	});

	document.addEventListener("click", (event) => {
		if (event.target.closest("[data-owner-menu-wrap]")) return;
		feed.querySelectorAll("[data-owner-menu]").forEach((menu) => { menu.hidden = true; });
		feed.querySelectorAll('.post-menu[data-action="menu"]').forEach((button) => button.setAttribute("aria-expanded", "false"));
	});

	document.querySelector("#comment-form").addEventListener("submit", async (event) => {
		event.preventDefault();
		if (!activeCommentPost) return;
		const input = document.querySelector("#comment-text");
		const body = input.value.trim();
		if (!body) return;
		if (window.UnisonApi.isConfigured() && !requireSignedIn()) return;
		try {
			const postData = postDataForElement(activeCommentPost);
			const key = activeCommentPost.dataset.postId || postData?.handle;
			let comments;
			if (window.UnisonApi.isConfigured()) {
				if (!activeCommentPost.dataset.postId) return showToast("This sample post is not on your Supabase backend.");
				await window.UnisonApi.createComment(activeCommentPost.dataset.postId, body);
				await createActivityNotification({ recipientId: activeCommentPost.dataset.userId, type: "comment", entityType: "post", entityId: activeCommentPost.dataset.postId });
				comments = await window.UnisonApi.listComments(activeCommentPost.dataset.postId);
			} else {
				comments = demoComments.get(key) || [];
				comments.push({ author: "Alex Morgan", body });
				demoComments.set(key, comments);
				if (postData) postData.replies = (postData.replies || 0) + 1;
			}
			renderComments(comments);
			activeCommentPost.querySelector('[data-field="replies"]').textContent = `${postData?.replies ?? comments.length} replies`;
			input.value = "";
		} catch (error) {
			showToast(error.message);
		}
	});

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (!requireSignedIn()) return;
		const text = input.value.trim();
		if (!text) return showToast("Write a message before sharing.");
		const postStatus = document.querySelector("#post-status");
		postStatus.hidden = true;
		postStatus.textContent = "";
		const shareButton = form.querySelector('[type="submit"]');
		if (shareButton.disabled) return;
		shareButton.disabled = true;
		shareButton.textContent = "Posting…";

		const user = window.UnisonAuth.getUser();
		const metadata = user?.user_metadata || {};
		const destination = currentView === "townsquare" ? "townsquare" : currentView === "community" ? "community" : postScope.value;
		// Community posts are always public; the private option only applies to Home posts.
		const visibility = destination === "community" ? "public" : postVisibility.value;
		const postData = {
			id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
			author: currentProfile?.display_name || metadata.display_name || user?.email?.split("@")[0] || "Alex Morgan",
			handle: currentProfile?.handle ? `@${currentProfile.handle}` : metadata.handle ? `@${metadata.handle}` : user ? `@${user.email?.split("@")[0]}` : "@alexm",
			time: "now",
			avatar: currentProfile?.avatar_url || metadata.avatar_url || fallbackAvatar,
			text,
			visibility,
			search: text,
			likes: 0,
			replies: 0,
			local: destination === "townsquare",
			community: destination === "community",
			localType: destination === "townsquare" ? "Neighborhood post" : destination === "community" ? "Community post" : "",
			image: selectedPhoto ? URL.createObjectURL(selectedPhoto) : "",
			imageAlt: selectedPhoto?.name || ""
		};
		try {
			if (window.UnisonApi.isConfigured()) {
				const savedPost = await window.UnisonApi.createPost({ text, scope: destination, visibility, imageFile: selectedPhoto });
				Object.assign(postData, savedPost);
			}
			feedPosts.unshift(postData);
			feed.prepend(renderPost(postData));
			form.reset();
			selectedPhoto = null;
			photoInput.value = "";
			document.querySelector("#photo-preview").hidden = true;
			if (currentView !== "townsquare" && currentView !== "community") setView("home");
			applyFilters();
			postStatus.hidden = true;
			showToast(window.UnisonApi.isConfigured() ? "Post published." : "Post added for this session.");
		} catch (error) {
			postStatus.textContent = error.message || "The post could not be published. Please try again.";
			postStatus.hidden = false;
			showToast(error.message);
		} finally {
			shareButton.disabled = false;
			shareButton.textContent = "Share post";
		}
	});

	// 05. Saved appearance controls
	document.body.dataset.accent = appearance.accent;
	document.body.dataset.theme = appearance.theme;
	document.body.classList.toggle("compact", appearance.compact);
	document.querySelectorAll("[data-accent-choice]").forEach((button) => {
		button.setAttribute("aria-pressed", String(button.dataset.accentChoice === appearance.accent));
		button.addEventListener("click", () => {
			appearance.accent = button.dataset.accentChoice;
			document.body.dataset.accent = appearance.accent;
			document.querySelectorAll("[data-accent-choice]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
			saveAppearance();
		});
	});
	document.querySelectorAll("[data-theme-choice]").forEach((button) => {
		button.setAttribute("aria-pressed", String(button.dataset.themeChoice === appearance.theme));
		button.addEventListener("click", () => {
			appearance.theme = button.dataset.themeChoice;
			document.body.dataset.theme = appearance.theme;
			document.querySelectorAll("[data-theme-choice]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
			saveAppearance();
		});
	});
	const compact = document.querySelector("#compact-mode");
	compact.checked = appearance.compact;
	compact.addEventListener("change", () => {
		appearance.compact = compact.checked;
		document.body.classList.toggle("compact", compact.checked);
		saveAppearance();
	});
	document.querySelector("#date-label").textContent = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date());
