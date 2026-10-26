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

		const post = document.createElement("article");
		post.className = "post";
		post.dataset.author = "you";
		post.dataset.search = text.toLowerCase();
		if (currentView === "townsquare") post.dataset.local = "true";
		const header = document.createElement("header");
		header.className = "post-header";
		const avatar = document.createElement("img");
		avatar.className = "avatar post-avatar";
		avatar.src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80";
		avatar.alt = "";
		const identity = document.createElement("div");
		identity.className = "post-identity";
		identity.innerHTML = '<div class="name-line"><span class="post-name">Alex Morgan</span><span class="post-handle">@alexm</span><span class="post-time">· now</span></div>';
		header.append(avatar, identity);
		const copy = document.createElement("p");
		copy.className = "post-copy";
		copy.textContent = text;
		const actions = document.createElement("div");
		actions.className = "post-actions";
		actions.innerHTML = '<button class="action" type="button" data-action="like" aria-pressed="false"><span class="action-icon">♡</span><span data-count>0</span><span data-label>Like</span></button><button class="action" type="button" data-action="reply"><span>◌</span><span>Reply</span></button><button class="action" type="button" data-action="share"><span>↗</span><span>Share</span></button><button class="action" type="button" data-action="save" aria-label="Save post" aria-pressed="false"><span>▱</span><span data-label>Save</span></button>';
		post.append(header, copy, actions);
		feed.prepend(post);
		form.reset();
		currentView = "home";
		currentFeed = "all";
		applyFilters();
		showToast("Shared with your circle");
	});

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