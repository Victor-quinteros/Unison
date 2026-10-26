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
	const commentsDialog = document.querySelector("#comments-dialog");
	const storyDialog = document.querySelector("#story-dialog");
	const profileDialog = document.querySelector("#profile-dialog");
	let currentView = "home";
	let currentFeed = "all";
	let lastRouteHash = "";
	let toastTimer;
	let signUpMode = false;
	let selectedPhoto = null;
	let activeCommentPost = null;
	let feedRequestId = 0;
	let profileRequestId = 0;
	let searchPeopleRequestId = 0;
	let searchGroupsRequestId = 0;
	let currentProfile = null;
	const fallbackAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80";
	let appearance = { accent: "coral", theme: "light", compact: false };

	function showToast(message) {
		toast.textContent = message;
		toast.classList.add("show");
		window.clearTimeout(toastTimer);
		toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2000);
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
		document.querySelectorAll("#account-button .avatar, .account .avatar, #composer-avatar, #profile-avatar-preview").forEach((image) => { image.src = avatar; });
		document.querySelector("#auth-signout").hidden = !user;
	}

	async function loadMyProfile() {
		if (!window.UnisonAuth.getUser() || !window.UnisonApi.isConfigured()) return null;
		currentProfile = await window.UnisonApi.getMyProfile();
		updateAccount(window.UnisonAuth.getUser(), currentProfile);
		if (currentProfile) {
			document.querySelector("#profile-display-name").value = currentProfile.display_name || "";
			document.querySelector("#profile-handle").value = currentProfile.handle || "";
			document.querySelector("#profile-bio").value = currentProfile.bio || "";
			document.querySelector("#profile-avatar-preview").src = currentProfile.avatar_url || fallbackAvatar;
			document.querySelector("#my-profile-email").textContent = window.UnisonAuth.getUser().email || "";
		}
		return currentProfile;
	}

	// 02. Feed rendering and filtering
	function renderPost(postData) {
		const template = document.querySelector("#post-template");
		const post = template.content.firstElementChild.cloneNode(true);
		if (postData.id) post.dataset.postId = postData.id;
		if (postData.userId) post.dataset.userId = postData.userId;
		if (postData.saved) post.classList.add("saved");
		post.dataset.author = postData.handle;
		post.dataset.search = `${postData.author} ${postData.handle} ${postData.search || ""} ${postData.text}`.toLowerCase();

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
		post.querySelectorAll("[data-profile-link]").forEach((profileLink) => {
			profileLink.dataset.profileId = postData.userId || "";
			profileLink.dataset.profileHandle = postData.handle || "";
			if (profileLink.classList.contains("post-avatar-link")) profileLink.setAttribute("aria-label", `Open ${postData.author}'s profile`);
		});
		post.querySelector('[data-field="author"]').textContent = postData.author;
		post.querySelector('[data-field="handle"]').textContent = postData.handle;
		post.querySelector('[data-field="time"]').textContent = `· ${postData.time}`;
		const textElement = post.querySelector('[data-field="text"]');
		postData.text.split(/(#[A-Za-z0-9_]+)/g).forEach((part) => {
			if (part.startsWith("#")) {
				const tag = document.createElement("span");
				tag.className = "tag";
				tag.textContent = part;
				textElement.append(tag);
			} else {
				textElement.append(document.createTextNode(part));
			}
		});

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

	let feedPosts = window.UnisonApi.isConfigured() && !window.UnisonAuth.getUser() ? [] : [...window.UnisonData.posts];
	function renderFeed() {
		feed.replaceChildren(...feedPosts.map(renderPost));
		applyFilters();
	}

	function setGroupButton(button, joined) {
		button.setAttribute("aria-pressed", String(joined));
		button.classList.toggle("joined", joined);
		button.textContent = joined ? "Joined" : "Join";
	}

	function setFollowButton(button, isFollowing) {
		button.setAttribute("aria-pressed", String(isFollowing));
		button.classList.toggle("following", isFollowing);
		button.textContent = isFollowing ? "Following" : "Follow";
	}

	async function refreshGroupMemberships() {
		if (!window.UnisonApi.isConfigured() || !window.UnisonAuth.getUser()) return;
		const memberships = await window.UnisonApi.listGroupMemberships();
		const joined = new Set(memberships.map((membership) => membership.group_id));
		document.querySelectorAll("[data-group-id]").forEach((button) => setGroupButton(button, joined.has(button.dataset.groupId)));
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

	async function refreshSearchGroups(query) {
		const requestId = ++searchGroupsRequestId;
		const section = document.querySelector("#search-groups-section");
		const list = document.querySelector("#search-groups-list");
		let groups;
		if (window.UnisonApi.isConfigured()) {
			groups = await window.UnisonApi.searchGroups(query);
		} else {
			groups = [...document.querySelectorAll(".right-rail [data-group-id]")]
				.filter((button) => button.closest(".suggestion")?.textContent.toLowerCase().includes(query.toLowerCase()))
				.map((button) => ({ id: button.dataset.groupId, name: button.closest(".suggestion").querySelector("strong")?.textContent || "Group", description: "Join the conversation." }));
		}
		if (requestId !== searchGroupsRequestId) return;
		list.replaceChildren(...groups.map((group) => {
			const card = document.createElement("article");
			card.className = "search-group-card";
			const name = document.createElement("strong");
			name.textContent = group.name;
			const description = document.createElement("p");
			description.textContent = group.description || "A group for people with shared interests.";
			const join = document.createElement("button");
			join.className = "join-button";
			join.type = "button";
			join.dataset.groupId = group.id;
			setGroupButton(join, demoJoinedGroups.has(group.id));
			card.append(name, description, join);
			return card;
		}));
		section.hidden = !groups.length;
		if (window.UnisonApi.isConfigured() && window.UnisonAuth.getUser()) await refreshGroupMemberships();
	}

	async function refreshFollowState() {
		if (!window.UnisonApi.isConfigured() || !window.UnisonAuth.getUser()) return;
		const followedIds = new Set(await window.UnisonApi.listFollowedIds());
		document.querySelectorAll("[data-follow-id]").forEach((button) => setFollowButton(button, followedIds.has(button.dataset.followId)));
	}

	async function openPublicProfile(userId, rawHandle = "") {
		if (window.UnisonApi.isConfigured() && !window.UnisonAuth.getUser()) {
			openAuthDialog("Sign in to view member profiles and posts.");
			return;
		}
		const requestId = ++profileRequestId;
		const cleanHandle = String(rawHandle).replace(/^@/, "");
		const name = document.querySelector("#public-profile-name");
		const handle = document.querySelector("#public-profile-handle");
		const bio = document.querySelector("#public-profile-bio");
		const avatar = document.querySelector("#public-profile-avatar");
		const posts = document.querySelector("#public-profile-posts");
		const follow = document.querySelector("#public-profile-follow");
		name.textContent = "Loading profile…";
		handle.textContent = cleanHandle ? `@${cleanHandle}` : "";
		bio.textContent = "";
		avatar.src = fallbackAvatar;
		posts.replaceChildren(Object.assign(document.createElement("p"), { className: "profile-posts-empty", textContent: "Loading posts…" }));
		follow.hidden = true;
		if (!profileDialog.open) profileDialog.showModal();
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
			name.textContent = profile.display_name || "Unison member";
			handle.textContent = profile.handle ? `@${profile.handle}` : "@member";
			bio.textContent = profile.bio || "";
			avatar.src = profile.avatar_url || fallbackAvatar;
			if (profile.id && profile.id !== window.UnisonAuth.getUser()?.id) {
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
				return card;
			}));
		} catch (error) {
			if (requestId !== profileRequestId) return;
			name.textContent = "Profile unavailable";
			posts.replaceChildren(Object.assign(document.createElement("p"), { className: "profile-posts-empty", textContent: error.message }));
		}
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
		if (!window.UnisonApi.isConfigured()) return;
		const requestId = ++feedRequestId;
		const scope = currentView === "townsquare" ? "townsquare" : currentView === "community" ? "community" : currentView === "saved" ? "saved" : currentFeed === "following" ? "following" : currentFeed === "mine" ? "mine" : "home";
			const results = await window.UnisonApi.listPosts({ scope, search: currentView === "search" ? "" : search.value.trim() });
		if (requestId !== feedRequestId) return;
		feedPosts = results;
		renderFeed();
	}

	function updatePrivateAccess() {
		const signedOut = !window.UnisonAuth.getUser();
		document.querySelector("#home").classList.toggle("signed-out", signedOut);
		authGate.hidden = !signedOut;
		if (signedOut) {
			feedPosts = [];
			feed.replaceChildren();
			emptyState.style.display = "none";
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
			refreshSupabaseFeed().catch((error) => showToast(error.message));
			loadMyProfile().catch((error) => showToast(error.message));
			refreshGroupMemberships().catch((error) => showToast(error.message));
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
		emptyState.style.display = visible ? "none" : "block";
	}

	function setView(view) {
		if (!window.UnisonAuth.getUser()) {
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
		viewTitle.textContent = view === "search" ? "Search results" : view === "my-profile" ? "My Profile" : view === "my-posts" ? "My posts" : view === "saved" ? "Saved" : view === "explore" ? "Explore" : view === "townsquare" ? "Townsquare" : view === "community" ? "Community feed" : "Home";
		pageSubtitle.textContent = view === "search" ? `Posts matching “${search.value.trim()}”` : view === "my-profile" ? "Manage your picture and the information people see on your profile." : view === "my-posts" ? "Everything you have shared with your circle." : view === "townsquare" ? "Your neighborhood, one conversation at a time." : view === "community" ? "Posts shared with every signed-in member." : "Good things happen when we find each other.";
		document.querySelector("#today-label").textContent = view === "search" ? "SEARCH YOUR CIRCLE" : view === "my-profile" ? "YOUR PUBLIC PROFILE" : view === "community" ? "SHARED WITH THE COMMUNITY" : "YOUR PEOPLE, YOUR PACE";
		document.querySelector("#home").classList.toggle("search-mode", view === "search");
		document.querySelector("#home").classList.toggle("profile-mode", view === "my-profile");
		document.querySelector("#my-profile-page").hidden = view !== "my-profile";
		townSquareIntro.hidden = view !== "townsquare";
		feedControls.hidden = view === "townsquare" || view === "community" || view === "search" || view === "my-profile";
		input.placeholder = view === "townsquare" ? "Share something happening nearby..." : view === "community" ? "Share with the community..." : "What's on your mind, Alex?";
		postScope.value = view === "community" ? "community" : "home";
		document.querySelector("#post-destination").hidden = view === "townsquare" || view === "community";
		document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
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
			loadMyProfile().catch((error) => showToast(error.message));
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

	document.querySelector("#account-button").addEventListener("click", () => {
		const user = window.UnisonAuth.getUser();
		if (user) {
			setAuthMode(false);
			document.querySelector("#auth-title").textContent = "Your account";
			document.querySelector("#auth-message").textContent = `Signed in as ${user.email}.`;
			document.querySelector("#auth-email").closest(".dialog-field").hidden = true;
			document.querySelector("#auth-password").closest(".dialog-field").hidden = true;
			document.querySelector("#auth-submit").hidden = true;
			document.querySelector("#auth-mode-toggle").hidden = true;
			document.querySelector("#auth-signout").hidden = false;
			if (!authDialog.open) authDialog.showModal();
			return;
		}
		document.querySelector("#auth-email").closest(".dialog-field").hidden = false;
		document.querySelector("#auth-password").closest(".dialog-field").hidden = false;
		document.querySelector("#auth-submit").hidden = false;
		document.querySelector("#auth-mode-toggle").hidden = false;
		setAuthMode(false);
		openAuthDialog();
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
	});
	document.querySelector("#profile-save").addEventListener("click", async (event) => {
		const button = event.currentTarget;
		const displayName = document.querySelector("#profile-display-name").value.trim();
		const handle = document.querySelector("#profile-handle").value.trim().replace(/^@/, "");
		const bio = document.querySelector("#profile-bio").value.trim();
		const photo = document.querySelector("#profile-avatar-file").files[0];
		if (!displayName) return showToast("Add a display name.");
		if (!/^[A-Za-z0-9_]{2,24}$/.test(handle)) return showToast("Use 2–24 letters, numbers, or underscores for your handle.");
		button.disabled = true;
		button.textContent = "Saving…";
		try {
			let avatarUrl = currentProfile?.avatar_url || "";
			if (photo) avatarUrl = await window.UnisonApi.uploadProfileImage(photo);
			currentProfile = await window.UnisonApi.updateMyProfile({ handle, displayName, bio, avatarUrl });
			updateAccount(window.UnisonAuth.getUser(), currentProfile);
			document.querySelector("#profile-avatar-preview").src = currentProfile.avatar_url || fallbackAvatar;
			document.querySelector("#profile-avatar-file").value = "";
			await Promise.all([refreshSupabaseFeed(), refreshPeople(), refreshStories()]);
			showToast("Profile saved.");
		} catch (error) {
			showToast(error.message);
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
			await loadMyProfile();
			updateAccount(window.UnisonAuth.getUser(), currentProfile);
			authDialog.close();
			await refreshSupabaseFeed();
			await refreshGroupMemberships();
			await refreshStories();
			await refreshPeople();
			showToast("You are signed in.");
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
	document.querySelectorAll("[data-group-id]").forEach((button) => button.addEventListener("click", async () => {
		const shouldJoin = button.getAttribute("aria-pressed") !== "true";
		if (window.UnisonApi.isConfigured() && !requireSignedIn()) return;
		try {
			if (window.UnisonApi.isConfigured()) await window.UnisonApi.toggleGroupMembership(button.dataset.groupId, shouldJoin);
			else if (shouldJoin) demoJoinedGroups.add(button.dataset.groupId);
			else demoJoinedGroups.delete(button.dataset.groupId);
			setGroupButton(button, shouldJoin);
		} catch (error) {
			showToast(error.message);
		}
	}));
	document.querySelectorAll("[data-coming-soon]").forEach((button) => button.addEventListener("click", () => showToast("That section is not available yet.")));
	document.querySelectorAll("[data-scroll-to]").forEach((button) => button.addEventListener("click", () => {
		document.querySelector(`#${button.dataset.scrollTo}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
	}));
	document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
	document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
		currentView = "home";
		currentFeed = button.dataset.filter;
		viewTitle.textContent = currentFeed === "following" ? "Your people, first." : currentFeed === "mine" ? "My posts" : "Your circle, in sync.";
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
			setFollowButton(button, !followingProfile);
			await refreshPeople();
		} catch (error) {
			showToast(error.message);
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
	document.querySelector("#search-groups-list").addEventListener("click", async (event) => {
		const button = event.target.closest("button[data-group-id]");
		if (!button) return;
		const shouldJoin = button.getAttribute("aria-pressed") !== "true";
		if (window.UnisonApi.isConfigured() && !requireSignedIn()) return;
		try {
			if (window.UnisonApi.isConfigured()) await window.UnisonApi.toggleGroupMembership(button.dataset.groupId, shouldJoin);
			else if (shouldJoin) demoJoinedGroups.add(button.dataset.groupId);
			else demoJoinedGroups.delete(button.dataset.groupId);
			setGroupButton(button, shouldJoin);
		} catch (error) {
			showToast(error.message);
		}
	});
	window.addEventListener("popstate", restoreSearchRoute);
	window.addEventListener("hashchange", restoreSearchRoute);
	restoreSearchRoute();

	function postDataForElement(postElement) {
		return feedPosts.find((post) => post.id
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

	// 04. Post actions and composer
	feed.addEventListener("click", async (event) => {
		const profileLink = event.target.closest("[data-profile-link]");
		if (profileLink) {
			await openPublicProfile(profileLink.dataset.profileId, profileLink.dataset.profileHandle);
			return;
		}
		const button = event.target.closest("button[data-action]");
		if (!button) return;
		const post = button.closest(".post");
		const postData = postDataForElement(post);
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
		} else if (button.classList.contains("post-menu")) {
			showToast("Post options are not available yet.");
		}
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
		const text = input.value.trim();
		if (!text) return showToast("Write a message before sharing.");
		if (window.UnisonApi.isConfigured() && !requireSignedIn()) return;
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
		const visibility = postVisibility.value;
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

	// 05. Session-only appearance controls
	document.body.dataset.accent = appearance.accent;
	document.body.dataset.theme = appearance.theme;
	document.querySelectorAll("[data-accent-choice]").forEach((button) => {
		button.setAttribute("aria-pressed", String(button.dataset.accentChoice === appearance.accent));
		button.addEventListener("click", () => {
			appearance.accent = button.dataset.accentChoice;
			document.body.dataset.accent = appearance.accent;
			document.querySelectorAll("[data-accent-choice]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
		});
	});
	document.querySelectorAll("[data-theme-choice]").forEach((button) => {
		button.setAttribute("aria-pressed", String(button.dataset.themeChoice === appearance.theme));
		button.addEventListener("click", () => {
			appearance.theme = button.dataset.themeChoice;
			document.body.dataset.theme = appearance.theme;
			document.querySelectorAll("[data-theme-choice]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
		});
	});
	document.querySelectorAll("[data-accent-choice]").forEach((button) => {
		button.setAttribute("aria-pressed", String(button.dataset.accentChoice === appearance.accent));
	});
	const compact = document.querySelector("#compact-mode");
	compact.checked = appearance.compact;
	compact.addEventListener("change", () => {
		appearance.compact = compact.checked;
		document.body.classList.toggle("compact", compact.checked);
	});
	document.querySelector("#date-label").textContent = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date());
