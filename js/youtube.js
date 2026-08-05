let youtubeVideos = [];
let visibleYoutubeItems = 0;

async function getYouTubeData(endpoint, parameters) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);

  Object.entries({
    ...parameters,
    key: CONFIG.youtube.apiKey
  }).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`YouTube API mengembalikan status ${response.status}.`);
  }

  return response.json();
}

function setYouTubeMessage(message) {
  const container = document.getElementById("youtubeContainer");
  if (!container) return;

  const status = document.createElement("p");
  status.className = "section-status is-error";
  status.textContent = message;
  container.replaceChildren(status);
}

function createYoutubeItem(video) {
  const videoId = video.contentDetails.videoId;
  const title = video.snippet.title || "Video Yayasan Al-Amin";

  const wrapper = document.createElement("div");
  wrapper.className = "youtube-item";

  const player = document.createElement("iframe");
  player.className = "youtube-player";
  player.title = title;
  player.src =
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&playsinline=1`;
  player.loading = "lazy";
  player.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  player.allowFullscreen = true;
  player.referrerPolicy = "strict-origin-when-cross-origin";

  const caption = document.createElement("p");
  caption.className = "youtube-caption";
  caption.textContent = title;

  wrapper.append(player, caption);

  return wrapper;
}

function renderNextYoutubePage() {
  const container = document.getElementById("youtubeContainer");
  const loadMoreButton = document.getElementById("loadMoreYoutube");

  if (!container || !loadMoreButton) return;

  const nextVideos = youtubeVideos.slice(
    visibleYoutubeItems,
    visibleYoutubeItems + CONFIG.youtube.pageSize
  );

  nextVideos.forEach(video => {
    container.append(createYoutubeItem(video));
  });

  visibleYoutubeItems += nextVideos.length;

  loadMoreButton.hidden = visibleYoutubeItems >= youtubeVideos.length;
}

async function loadYoutubeVideos() {
  const container = document.getElementById("youtubeContainer");
  const loadMoreButton = document.getElementById("loadMoreYoutube");
  const youtubeButton = document.getElementById("youtubeButton");

  if (!container || !loadMoreButton) return;

  try {
    const channelData = await getYouTubeData("channels", {
      part: "contentDetails",
      id: CONFIG.youtube.channelId
    });

    const uploadsPlaylistId =
      channelData.items &&
      channelData.items[0] &&
      channelData.items[0].contentDetails &&
      channelData.items[0].contentDetails.relatedPlaylists &&
      channelData.items[0].contentDetails.relatedPlaylists.uploads;

    if (!uploadsPlaylistId) {
      throw new Error("Playlist unggahan channel tidak ditemukan.");
    }

    const playlistData = await getYouTubeData("playlistItems", {
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "20"
    });

    youtubeVideos = (playlistData.items || []).filter(item => {
      return (
        item.contentDetails &&
        item.contentDetails.videoId &&
        item.snippet
      );
    });

    if (youtubeVideos.length === 0) {
      throw new Error("Belum ada video publik yang dapat ditampilkan.");
    }

    visibleYoutubeItems = 0;
    container.replaceChildren();

    renderNextYoutubePage();

    loadMoreButton.addEventListener("click", renderNextYoutubePage);

    if (youtubeButton) {
      youtubeButton.href = CONFIG.youtube.channelUrl;
      youtubeButton.hidden = false;
    }

  } catch (error) {
    console.error("YouTube Error:", error);
    setYouTubeMessage(
      `Video belum dapat dimuat: ${error.message}`
    );
  }
}