// Secret Garden — Supabase synced version
// Add this BEFORE this file in your HTML:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// Then:
// <script src="script.js"></script>

const garden = document.getElementById("garden");
const modal = document.getElementById("modal");
const gallery = document.getElementById("gallery");
const galleryGrid = document.getElementById("galleryGrid");
const toast = document.getElementById("toast");

const SUPABASE_URL = "https://tzbumlijnjsjruxsalmq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnVtbGlqbmpzanJ1eHNhbG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTQxNTksImV4cCI6MjEwNTgzMDE1OX0.s0qAuOM-yNAw9y4ArBSUDOdFn2ybHS5fpilV-4jG5YM";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const STORAGE_KEY = "secretGardenFlowers";
const TABLE = "flowers";

let flowers = [];
let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function flowerPosition() {
  const x = 15 + Math.random() * 70;
  const y = 20 + Math.random() * 38;
  return { left: x, bottom: y };
}

function createFlower(data, index) {
  if (!garden) return;

  const el = document.createElement("div");
  el.className = "flower";

  const message = data.message || data.name || "A flower with no message, just because.";
  el.title = message;

  const pos = data.pos || flowerPosition();
  el.style.left = `${Number(pos.left) || 0}%`;
  el.style.bottom = `${Number(pos.bottom) || 0}%`;
  el.style.setProperty(
    "--flower",
    ["#f3a4b6", "#f5bd65", "#c8a1e5", "#f59aa6", "#ffd86e"][index % 5]
  );
  el.style.animationDelay = `${index * 0.07}s`;

  const petals = document.createElement("div");
  petals.className = "petals";

  for (let i = 0; i < 5; i++) {
    const petal = document.createElement("span");
    petal.className = "petal";
    petals.appendChild(petal);
  }

  const center = document.createElement("span");
  center.className = "center";

  el.append(petals, center);
  el.addEventListener("click", () => showToast(message));
  garden.appendChild(el);
}

function renderGarden() {
  if (!garden) return;
  garden.querySelectorAll(".flower").forEach((flower) => flower.remove());
  flowers.forEach((flower, index) => createFlower(flower, index));
}

function renderGallery() {
  if (!galleryGrid) return;

  galleryGrid.replaceChildren();

  if (!flowers.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = "No flowers yet.<br>Plant the first one! 🌱";
    galleryGrid.appendChild(empty);
    return;
  }

  [...flowers].reverse().forEach((flower) => {
    const card = document.createElement("div");
    card.className = "card";

    const emoji = document.createElement("div");
    emoji.className = "card-flower";
    emoji.textContent = flower.emoji || "🌸";

    const name = document.createElement("strong");
    name.textContent = flower.name || "Little flower";

    const message = document.createElement("small");
    message.textContent = flower.message || "Just growing quietly 🌿";

    card.append(emoji, name, message);
    galleryGrid.appendChild(card);
  });
}

function normalizeFlower(row) {
  return {
    id: row.id,
    emoji: row.emoji || "🌸",
    name: row.name || "",
    message: row.message || "",
    pos: row.pos || flowerPosition(),
    created: row.created_at || row.created || new Date().toISOString()
  };
}

async function loadFlowers() {
  const { data, error } = await supabaseClient
    .from(TABLE)
    .select("id, emoji, name, message, pos, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase load error:", error);
    showToast("ERROR: " + error.message);
    return;
  }

  flowers = (data || []).map(normalizeFlower);
  renderGarden();
  renderGallery();
}

async function plantFlower() {
  const flowerType = document.getElementById("flowerType");
  const flowerName = document.getElementById("flowerName");
  const flowerMessage = document.getElementById("flowerMessage");

  const flower = {
  type: "flower",
  emoji: flowerType?.value || "🌸",
  name: flowerName?.value.trim() || "",
  message: flowerMessage?.value.trim() || "",
  pos: flowerPosition()
};

  const { data, error } = await supabaseClient
    .from(TABLE)
    .insert(flower)
    .select("id, emoji, name, message, pos, created_at")
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    showToast("Could not plant the flower. Check Supabase policies.");
    return;
  }

  // Add immediately; Realtime will ignore the duplicate event.
  flowers.push(normalizeFlower(data));
  renderGarden();
  renderGallery();

  if (flowerName) flowerName.value = "";
  if (flowerMessage) flowerMessage.value = "";

  modal?.classList.remove("show");
  showToast("Your flower has bloomed! 🌸");
}

function applyRealtimeChange(payload) {
  if (payload.eventType === "INSERT") {
    const flower = normalizeFlower(payload.new);

    // Avoid duplicating an insert that this browser already added.
    if (!flowers.some((item) => item.id === flower.id)) {
      flowers.push(flower);
      flowers.sort((a, b) => new Date(a.created) - new Date(b.created));
      renderGarden();
      renderGallery();
    }
  }

  if (payload.eventType === "UPDATE") {
    const flower = normalizeFlower(payload.new);
    const index = flowers.findIndex((item) => item.id === flower.id);

    if (index !== -1) {
      flowers[index] = flower;
      renderGarden();
      renderGallery();
    }
  }

  if (payload.eventType === "DELETE") {
    flowers = flowers.filter((item) => item.id !== payload.old.id);
    renderGarden();
    renderGallery();
  }
}

function subscribeToFlowers() {
  supabaseClient
    .channel("secret-garden-flowers")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: TABLE
      },
      applyRealtimeChange
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("Secret Garden realtime sync connected.");
      }
    });
}

async function clearGarden() {
  const confirmed = confirm(
    "This removes ALL flowers from the shared garden for everyone. Continue?"
  );
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from(TABLE)
    .delete()
    .not("id", "is", null);

  if (error) {
    console.error("Supabase delete error:", error);
    showToast("Could not clear the shared garden.");
    return;
  }

  // Realtime DELETE events will update every connected browser.
  showToast("The shared garden has been cleared.");
}

function setup() {
  document.getElementById("drawBtn")?.addEventListener("click", () => {
    modal?.classList.add("show");
  });

  document.getElementById("closeModal")?.addEventListener("click", () => {
    modal?.classList.remove("show");
  });

  document.getElementById("galleryBtn")?.addEventListener("click", () => {
    renderGallery();
    gallery?.classList.add("show");
  });

  document.getElementById("closeGallery")?.addEventListener("click", () => {
    gallery?.classList.remove("show");
  });

  document.getElementById("plantBtn")?.addEventListener("click", plantFlower);

  document.getElementById("surpriseBtn")?.addEventListener("click", () => {
    const surprises = [
      "You deserve a garden full of good things. 🌷",
      "Something beautiful is growing here. 🌱",
      "Take a breath. Stay a while. 🍃",
      "Tiny steps still make a garden. 🌼",
      "Today is a good day to bloom. 🌻"
    ];
    showToast(surprises[Math.floor(Math.random() * surprises.length)]);
  });

  document.getElementById("clearBtn")?.addEventListener("click", clearGarden);

  [modal, gallery].forEach((layer) => {
    layer?.addEventListener("click", (event) => {
      if (event.target === layer) layer.classList.remove("show");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      modal?.classList.remove("show");
      gallery?.classList.remove("show");
    }
  });

  // Load the canonical shared state, then listen for changes.
  loadFlowers();
  subscribeToFlowers();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setup, { once: true });
} else {
  setup();
}
