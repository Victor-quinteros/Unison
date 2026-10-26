	// 01. Application state
	const form = document.querySelector("#post-form");
	const input = document.querySelector("#post-text");
	const feed = document.querySelector("#feed");
	const search = document.querySelector("#search");
	const emptyState = document.querySelector("#empty-state");
	const viewTitle = document.querySelector("#view-title");
	const pageSubtitle = document.querySelector(".page-subtitle");
	const townSquareIntro = document.querySelector("#town-square-intro");
	const feedControls = document.querySelector(".feed-controls");
	const toast = document.querySelector("#toast");
	const following = new Set();
	let currentView = "home";
	let currentFeed = "all";
	let toastTimer;

	function showToast(message) {
		toast.textContent = message;
		toast.classList.add("show");
		window.clearTimeout(toastTimer);
		toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2000);
	}

	// 02. Feed rendering and filtering
	function renderPost(postData) {
		const template = document.querySelector("#post-template");
		const post = template.content.firstElementChild.cloneNode(true);
		post.dataset.author = postData.handle;
		post.dataset.search = `${postData.author} ${postData.handle} ${postData.search || ""} ${postData.text}`.toLowerCase();

		if (postData.local) {
			post.classList.add("town-square-post");
			post.dataset.local = "true";
			post.querySelector('[data-field="local-type"]').textContent = postData.localType;
		} else {
			post.querySelector('[data-field="local-meta"]').remove();
		}

		post.querySelector('[data-field="avatar"]').src = postData.avatar;
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
		post.querySelector('[data-field="replies"]').textContent = `${postData.replies || 0} replies`;
		return post;
	}

	const feedPosts = window.UnisonData.posts;
	feed.replaceChildren(...feedPosts.map(renderPost));

	function applyFilters() {
		const query = search.value.trim().toLowerCase();
		let visible = 0;
		feed.querySelectorAll(".post").forEach((post) => {
			const matchesSearch = !query || `${post.textContent} ${post.dataset.search || ""}`.toLowerCase().includes(query);
			const matchesView = currentView === "saved" ? post.classList.contains("saved") : currentView !== "townsquare" || post.dataset.local === "true";
			const matchesFollowing = currentFeed !== "following" || following.has(post.dataset.author);
			post.hidden = !(matchesSearch && matchesView && matchesFollowing);
			if (!post.hidden) visible += 1;
		});
		emptyState.style.display = visible ? "none" : "block";
	}

	function setView(view) {
		currentView = view;
		currentFeed = "all";
		viewTitle.textContent = view === "saved" ? "Saved" : view === "explore" ? "Explore" : view === "townsquare" ? "Townsquare" : "Home";
		pageSubtitle.textContent = view === "townsquare" ? "Your neighborhood, one conversation at a time." : "Good things happen when we find each other.";
		townSquareIntro.hidden = view !== "townsquare";
		feedControls.hidden = view === "townsquare";
		input.placeholder = view === "townsquare" ? "Share something happening nearby..." : "What's on your mind, Alex?";
		document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
		document.querySelectorAll("[data-filter]").forEach((button) => {
			const active = button.dataset.filter === "all";
			button.classList.toggle("active", active);
			button.setAttribute("aria-selected", String(active));
		});
		if (view === "explore") search.focus();
		applyFilters();
	}

	// 03. Navigation and feed controls
	document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
	document.querySelectorAll("[data-coming-soon]").forEach((button) => button.addEventListener("click", () => showToast("This section is coming soon")));
	document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
		currentView = "home";
		currentFeed = button.dataset.filter;
		viewTitle.textContent = currentFeed === "following" ? "Your people, first." : "Your circle, in sync.";
		document.querySelectorAll("[data-filter]").forEach((item) => {
			const active = item.dataset.filter === currentFeed;
			item.classList.toggle("active", active);
			item.setAttribute("aria-selected", String(active));
		});
		applyFilters();
	}));
	document.querySelectorAll("[data-focus-composer]").forEach((button) => button.addEventListener("click", () => {
		input.focus();
		document.querySelector(".composer").scrollIntoView({ behavior: "smooth", block: "center" });
	}));
	document.querySelectorAll("[data-follow]").forEach((button) => button.addEventListener("click", () => {
		const isFollowing = following.has(button.dataset.follow);
		if (isFollowing) following.delete(button.dataset.follow);
		else following.add(button.dataset.follow);
		button.classList.toggle("following", !isFollowing);
		button.textContent = isFollowing ? "Follow" : "Following";
		applyFilters();
	}));
	document.querySelectorAll("[data-topic]").forEach((button) => button.addEventListener("click", () => {
		search.value = button.dataset.topic;
		setView("explore");
		applyFilters();
	}));
	search.addEventListener("input", applyFilters);

	// 04. Post actions and composer
	feed.addEventListener("click", async (event) => {
		const button = event.target.closest("button[data-action]");
		if (!button) return;
		const post = button.closest(".post");
		if (button.dataset.action === "like") {
			const liked = button.getAttribute("aria-pressed") === "true";
			const count = button.querySelector("[data-count]");
			count.textContent = String(Number(count.textContent) + (liked ? -1 : 1));
			button.setAttribute("aria-pressed", String(!liked));
			button.classList.toggle("liked", !liked);
			button.querySelector(".action-icon").textContent = liked ? "♡" : "♥";
			button.querySelector("[data-label]").textContent = liked ? "Like" : "Liked";
		} else if (button.dataset.action === "save") {
			const saved = post.classList.toggle("saved");
			button.setAttribute("aria-pressed", String(saved));
			button.classList.toggle("saved", saved);
			button.querySelector("[data-label]").textContent = saved ? "Saved" : "Save";
			showToast(saved ? "Added to saved posts" : "Removed from saved posts");
			applyFilters();
		} else if (button.dataset.action === "reply") {
			showToast("Replies are coming soon");
		} else if (button.dataset.action === "share") {
			try {
				await navigator.clipboard.writeText(window.location.href);
				showToast("Page link copied");
			} catch {
				showToast("Sharing is not available in this browser");
			}
		}
	});

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		const text = input.value.trim();
		if (!text) return;

		const postData = {
			author: "Alex Morgan",
			handle: "@alexm",
			time: "now",
			avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
			text,
			search: text,
			likes: 0,
			replies: 0,
			local: currentView === "townsquare",
			localType: "Neighbor post"
		};
		feedPosts.unshift(postData);
		feed.prepend(renderPost(postData));
		form.reset();
		currentView = "home";
		currentFeed = "all";
		applyFilters();
		showToast("Shared with your circle");
	});

	// 05. Appearance preferences
	let preferences = JSON.parse(localStorage.getItem("unison-preferences") || "{}");
	function savePreference(key, value) {
		preferences = { ...preferences, [key]: value };
		localStorage.setItem("unison-preferences", JSON.stringify(preferences));
	}
	if (preferences.accent) document.body.dataset.accent = preferences.accent;
	if (preferences.theme) document.body.dataset.theme = preferences.theme;
	if (preferences.compact) document.body.classList.add("compact");
	document.querySelectorAll("[data-accent-choice]").forEach((button) => {
		button.setAttribute("aria-pressed", String(button.dataset.accentChoice === (preferences.accent || "coral")));
		button.addEventListener("click", () => {
			document.body.dataset.accent = button.dataset.accentChoice;
			document.querySelectorAll("[data-accent-choice]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
			savePreference("accent", button.dataset.accentChoice);
		});
	});
	document.querySelectorAll("[data-theme-choice]").forEach((button) => {
		button.setAttribute("aria-pressed", String(button.dataset.themeChoice === (preferences.theme || "light")));
		button.addEventListener("click", () => {
			document.body.dataset.theme = button.dataset.themeChoice;
			document.querySelectorAll("[data-theme-choice]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
			savePreference("theme", button.dataset.themeChoice);
		});
	});
	const compact = document.querySelector("#compact-mode");
	compact.checked = Boolean(preferences.compact);
	compact.addEventListener("change", () => {
		document.body.classList.toggle("compact", compact.checked);
		savePreference("compact", compact.checked);
	});
	document.querySelector("#date-label").textContent = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date());