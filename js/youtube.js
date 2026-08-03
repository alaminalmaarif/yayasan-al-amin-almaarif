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

async function loadYoutubeVideos() {
  const container = document.getElementById("youtubeContainer");
  if (!container) return;

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
      maxResults: "5"
    });

    const latestVideo = (playlistData.items || []).find(item => {
      return item.contentDetails && item.contentDetails.videoId;
    });

    if (!latestVideo) {
      throw new Error("Belum ada video publik yang dapat ditampilkan.");
    }

    const player = document.createElement("iframe");
    player.className = "youtube-player";
    player.title = "Video terbaru kanal YouTube Yayasan Pendidikan Islam Al-Amin Al-Ma'arif";
    player.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(latestVideo.contentDetails.videoId)}?rel=0&playsinline=1`;
    player.loading = "lazy";
    player.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    player.allowFullscreen = true;
    player.referrerPolicy = "strict-origin-when-cross-origin";

    container.replaceChildren(player);
  } catch (error) {
    console.error("YouTube Error:", error);
    setYouTubeMessage(`Video terbaru belum dapat dimuat: ${error.message}`);
  }
}