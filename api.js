// 01. API configuration
const apiBaseUrl = (window.UNISON_API_BASE_URL || "").replace(/\/+$/, "");

// 02. Shared request handling
async function apiRequest(path, options = {}) {
	if (!apiBaseUrl) {
		throw new Error("Set window.UNISON_API_BASE_URL before making API requests.");
	}

	const url = new URL(path.replace(/^\/+/, ""), `${apiBaseUrl}/`);
	const headers = new Headers(options.headers || {});
	if (options.body !== undefined) headers.set("Content-Type", "application/json");
	const response = await fetch(url, {
		...options,
		headers,
		body: options.body === undefined ? undefined : JSON.stringify(options.body)
	});
	const contentType = response.headers.get("content-type") || "";
	const data = contentType.includes("application/json") ? await response.json() : null;

	if (!response.ok) {
		throw new Error(data?.message || `Request failed with status ${response.status}.`);
	}

	return data;
}

// 03. Post endpoints
window.UnisonApi = Object.freeze({
	listPosts({ scope = "home", search = "" } = {}) {
		const params = new URLSearchParams({ scope });
		if (search) params.set("search", search);
		return apiRequest(`posts?${params}`);
	},

	createPost({ text, scope = "home" }) {
		const content = String(text || "").trim();
		if (!content) throw new TypeError("Post text is required.");
		return apiRequest("posts", {
			method: "POST",
			body: { text: content, scope }
		});
	},

	likePost(postId) {
		if (!postId) throw new TypeError("Post ID is required.");
		return apiRequest(`posts/${encodeURIComponent(postId)}/likes`, { method: "POST" });
	}
});