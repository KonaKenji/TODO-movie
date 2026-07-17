import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCSO0aFMHjzgYykc4qn9zLhoscIdOChOTc",
  authDomain: "todo-movie-3e68c.firebaseapp.com",
  projectId: "todo-movie-3e68c",
  storageBucket: "todo-movie-3e68c.firebasestorage.app",
  messagingSenderId: "37689283560",
  appId: "1:37689283560:web:90dbce65ffd90ad9920a5d",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const watchlistCollectionRef = collection(db, "watchlist");

const CONFIG = {
  API_KEY:
    "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmMjkzZTBiMDVkYzZhN2VjMzQ1NjMyOTVlNTlhZjM0YiIsIm5iZiI6MTc4NDI5MDMwOC45NzUwMDAxLCJzdWIiOiI2YTVhMWMwNDkzMGYwODJjNzJmMzdlNGUiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.ijIxJvK4ahc-w6WmxKNoRbNqvnAmWeCDyLYugDx9Xe8",
  BASE_URL: "https://api.themoviedb.org/3",
  IMG_BASE: "https://image.tmdb.org/t/p",
};

const posterUrl = (path, size = "w500") =>
  path ? `${CONFIG.IMG_BASE}/${size}${path}` : "https://placehold.co/500x750/141414/808080?text=No+Image";

const backdropUrl = (path, size = "original") =>
  path ? `${CONFIG.IMG_BASE}/${size}${path}` : "";

async function fetchFromTMDB(path, params = {}) {
  const url = new URL(`${CONFIG.BASE_URL}${path}`);
  url.searchParams.set("language", "ko-KR");
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${CONFIG.API_KEY}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`TMDB API 요청 실패 (${response.status}): ${path}`);
  }

  return response.json();
}

/* ---------- Toast / error feedback ---------- */

const toastContainer = document.getElementById("toastContainer");

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function showError(message) {
  showToast(message, "error");
}

function showSuccess(message) {
  showToast(message, "success");
}

function setLoading(isLoading) {
  const overlay = document.getElementById("loadingOverlay");
  overlay.classList.toggle("hidden", !isLoading);
}

function escapeHtml(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Watchlist (Firestore) ---------- */

const watchlistMap = new Map();

function isInWatchlist(id) {
  return watchlistMap.has(String(id));
}

async function toggleWatchlist(movie) {
  const id = String(movie.id);
  const ref = doc(watchlistCollectionRef, id);

  try {
    if (isInWatchlist(id)) {
      await deleteDoc(ref);
      showSuccess(`"${movie.title}"을 내 목록에서 제거했습니다.`);
    } else {
      await setDoc(ref, {
        id: movie.id,
        title: movie.title || "",
        poster_path: movie.poster_path || null,
        backdrop_path: movie.backdrop_path || null,
        vote_average: movie.vote_average ?? null,
        release_date: movie.release_date || null,
        addedAt: serverTimestamp(),
      });
      showSuccess(`"${movie.title}"을 내 목록에 추가했습니다.`);
    }
  } catch (err) {
    console.error(err);
    showError("내 목록 업데이트에 실패했습니다. Firestore 보안 규칙을 확인해주세요.");
  }
}

function refreshWatchlistButtons() {
  document.querySelectorAll(".watchlist-toggle").forEach((btn) => {
    const active = isInWatchlist(btn.dataset.movieId);
    btn.classList.toggle("active", active);
    btn.textContent = active ? "✓" : "+";
    btn.setAttribute("aria-label", active ? "내 목록에서 제거" : "내 목록에 추가");
  });

  if (currentModalMovie) {
    const active = isInWatchlist(currentModalMovie.id);
    modalWatchlistBtn.classList.toggle("active", active);
    modalWatchlistBtn.textContent = active ? "✓ 내 목록에서 제거" : "+ 내 목록에 추가";
  }
}

function subscribeWatchlist() {
  onSnapshot(
    watchlistCollectionRef,
    (snapshot) => {
      watchlistMap.clear();
      snapshot.forEach((docSnap) => {
        watchlistMap.set(docSnap.id, { id: Number(docSnap.id), ...docSnap.data() });
      });
      refreshWatchlistButtons();
      if (currentView === "mylist") renderMyList();
    },
    (err) => {
      console.error(err);
      showError("내 목록을 불러오지 못했습니다. Firestore 설정을 확인해주세요.");
    }
  );
}

/* ---------- Movie cards ---------- */

function createMovieCard(movie) {
  const card = document.createElement("div");
  card.className = "movie-card";
  card.dataset.movieId = movie.id;

  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
  const active = isInWatchlist(movie.id);
  const safeTitle = escapeHtml(movie.title);

  card.innerHTML = `
    <button class="watchlist-toggle${active ? " active" : ""}" type="button" data-movie-id="${movie.id}" aria-label="${
    active ? "내 목록에서 제거" : "내 목록에 추가"
  }">${active ? "✓" : "+"}</button>
    <img src="${posterUrl(movie.poster_path)}" alt="${safeTitle}" loading="lazy" />
    <div class="movie-card-info">
      <p class="movie-card-title">${safeTitle}</p>
      <p class="movie-card-rating">★ ${rating}</p>
    </div>
  `;

  card.querySelector(".watchlist-toggle").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleWatchlist(movie);
  });

  card.addEventListener("click", () => openMovieModal(movie.id));
  return card;
}

function renderRow(containerId, movies) {
  const track = document.getElementById(containerId);
  if (!track) return;
  track.innerHTML = "";
  movies.forEach((movie) => {
    if (!movie.poster_path && !movie.title) return;
    track.appendChild(createMovieCard(movie));
  });
}

let currentHeroMovie = null;

function renderHero(movies) {
  const withBackdrop = movies.filter((m) => m.backdrop_path);
  const pool = withBackdrop.length ? withBackdrop : movies;
  if (!pool.length) return;

  const movie = pool[Math.floor(Math.random() * pool.length)];
  currentHeroMovie = movie;

  document.getElementById("heroBackdrop").style.backgroundImage = `url(${backdropUrl(movie.backdrop_path)})`;
  document.getElementById("heroTitle").textContent = movie.title;
  document.getElementById("heroOverview").textContent = movie.overview || "줄거리 정보가 없습니다.";
}

document.getElementById("heroDetailBtn").addEventListener("click", () => {
  if (currentHeroMovie) openMovieModal(currentHeroMovie.id);
});

/* ---------- Modal ---------- */

const modalOverlay = document.getElementById("modalOverlay");
const modalCloseBtn = document.getElementById("modalClose");
const modalWatchlistBtn = document.getElementById("modalWatchlistBtn");
let currentModalMovie = null;

function formatRuntime(minutes) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

async function openMovieModal(movieId) {
  modalOverlay.hidden = false;
  document.body.style.overflow = "hidden";

  currentModalMovie = null;
  modalWatchlistBtn.disabled = true;
  modalWatchlistBtn.textContent = "...";
  document.getElementById("modalTitle").textContent = "불러오는 중...";
  document.getElementById("modalOverview").textContent = "";
  document.getElementById("modalRating").textContent = "";
  document.getElementById("modalRelease").textContent = "";
  document.getElementById("modalRuntime").textContent = "";
  document.getElementById("modalGenres").innerHTML = "";
  document.getElementById("modalTrailer").innerHTML = "";
  document.getElementById("modalBackdrop").style.backgroundImage = "";

  try {
    const [details, videos] = await Promise.all([
      fetchFromTMDB(`/movie/${movieId}`),
      fetchFromTMDB(`/movie/${movieId}/videos`),
    ]);

    document.getElementById("modalBackdrop").style.backgroundImage = `url(${backdropUrl(details.backdrop_path)})`;
    document.getElementById("modalTitle").textContent = details.title;
    document.getElementById("modalRating").textContent = details.vote_average
      ? `★ ${details.vote_average.toFixed(1)}`
      : "";
    document.getElementById("modalRelease").textContent = details.release_date
      ? details.release_date.slice(0, 4)
      : "";
    document.getElementById("modalRuntime").textContent = formatRuntime(details.runtime);
    document.getElementById("modalOverview").textContent = details.overview || "줄거리 정보가 없습니다.";

    const genresEl = document.getElementById("modalGenres");
    (details.genres || []).forEach((genre) => {
      const badge = document.createElement("span");
      badge.className = "genre-badge";
      badge.textContent = genre.name;
      genresEl.appendChild(badge);
    });

    const trailer = (videos.results || []).find(
      (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
    );
    const trailerEl = document.getElementById("modalTrailer");
    if (trailer) {
      trailerEl.innerHTML = `<iframe src="https://www.youtube.com/embed/${trailer.key}" title="${escapeHtml(
        trailer.name
      )}" allowfullscreen></iframe>`;
    } else {
      trailerEl.innerHTML = `<p class="modal-trailer-empty">예고편 영상이 없습니다.</p>`;
    }

    currentModalMovie = {
      id: details.id,
      title: details.title,
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
      vote_average: details.vote_average,
      release_date: details.release_date,
    };
    modalWatchlistBtn.disabled = false;
    refreshWatchlistButtons();
  } catch (err) {
    console.error(err);
    document.getElementById("modalTitle").textContent = "정보를 불러올 수 없습니다.";
    modalWatchlistBtn.textContent = "+ 내 목록에 추가";
    showError("영화 상세정보를 불러오는 중 오류가 발생했습니다.");
  }
}

function closeModal() {
  modalOverlay.hidden = true;
  document.body.style.overflow = "";
}

modalWatchlistBtn.addEventListener("click", () => {
  if (currentModalMovie) toggleWatchlist(currentModalMovie);
});

modalCloseBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalOverlay.hidden) closeModal();
});

/* ---------- View switching (home / search / my list) ---------- */

const rowsContainer = document.getElementById("rowsContainer");
const heroSection = document.getElementById("hero");
const searchResultsSection = document.getElementById("searchResults");
const myListSection = document.getElementById("myListSection");
const myListGrid = document.getElementById("myListGrid");
const myListEmptyMessage = document.getElementById("myListEmptyMessage");
const navLinks = document.querySelectorAll(".nav-link");

let currentView = "home";

function setView(view) {
  currentView = view;
  heroSection.hidden = view !== "home";
  rowsContainer.hidden = view !== "home";
  searchResultsSection.hidden = view !== "search";
  myListSection.hidden = view !== "mylist";

  navLinks.forEach((link) => {
    const isActive = link.dataset.view === view || (view === "search" && link.dataset.view === "home");
    link.classList.toggle("active", isActive);
  });

  if (view === "mylist") renderMyList();
}

function renderMyList() {
  myListGrid.innerHTML = "";
  const movies = Array.from(watchlistMap.values()).sort((a, b) => {
    const at = a.addedAt?.seconds || 0;
    const bt = b.addedAt?.seconds || 0;
    return bt - at;
  });

  myListEmptyMessage.hidden = movies.length > 0;
  movies.forEach((movie) => myListGrid.appendChild(createMovieCard(movie)));
}

navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    if (link.dataset.view === "home") {
      searchInput.value = "";
      searchClearBtn.hidden = true;
    }
    setView(link.dataset.view);
  });
});

/* ---------- Search ---------- */

const searchInput = document.getElementById("searchInput");
const searchClearBtn = document.getElementById("searchClear");
const searchResultsGrid = document.getElementById("searchResultsGrid");
const searchResultsTitle = document.getElementById("searchResultsTitle");
const searchEmptyMessage = document.getElementById("searchEmptyMessage");

let searchDebounceTimer = null;

async function performSearch(query) {
  try {
    const data = await fetchFromTMDB("/search/movie", { query, include_adult: false });
    const results = (data.results || []).filter((m) => m.poster_path || m.title);

    searchResultsTitle.textContent = `"${query}" 검색 결과`;
    searchResultsGrid.innerHTML = "";
    searchEmptyMessage.hidden = results.length > 0;

    results.forEach((movie) => {
      searchResultsGrid.appendChild(createMovieCard(movie));
    });
  } catch (err) {
    console.error(err);
    showError("검색 중 오류가 발생했습니다.");
  }
}

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();
  searchClearBtn.hidden = query.length === 0;

  clearTimeout(searchDebounceTimer);

  if (!query) {
    setView("home");
    return;
  }

  searchDebounceTimer = setTimeout(() => {
    setView("search");
    performSearch(query);
  }, 400);
});

searchClearBtn.addEventListener("click", () => {
  searchInput.value = "";
  searchClearBtn.hidden = true;
  setView("home");
  searchInput.focus();
});

/* ---------- Init ---------- */

async function init() {
  setLoading(true);
  subscribeWatchlist();

  try {
    const [nowPlaying, popular, topRated, upcoming] = await Promise.all([
      fetchFromTMDB("/movie/now_playing"),
      fetchFromTMDB("/movie/popular"),
      fetchFromTMDB("/movie/top_rated"),
      fetchFromTMDB("/movie/upcoming"),
    ]);

    renderHero(nowPlaying.results || []);
    renderRow("row-now_playing", nowPlaying.results || []);
    renderRow("row-popular", popular.results || []);
    renderRow("row-top_rated", topRated.results || []);
    renderRow("row-upcoming", upcoming.results || []);
  } catch (err) {
    console.error(err);
    showError("영화 정보를 불러오지 못했습니다. API 키를 확인해주세요.");
  } finally {
    setLoading(false);
  }
}

document.addEventListener("DOMContentLoaded", init);
