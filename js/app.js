// =====================================================================
// CONFIGURACIÓN  (Supabase > Project Settings > API)
// La "anon key" es pública por diseño: la seguridad la da RLS en la base.
// =====================================================================
const SUPABASE_URL = "https://xcnwpgvoxeazusayzcsy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ecVEFm7qBiBTZqpAGoe0Xw_sHqyCBkU";
const WHATSAPP_NUMBER = "573145305676"; // Ej: "573001234567" (código de país + número, sin + ni espacios)

const PLACEHOLDER_IMG = "https://placehold.co/600x450/1a1a1a/c89e6a?text=Mueble+CDN";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================================
// ESTADO
// =====================================================================
let products = [];
let currentFilter = "Todos";
let activeProduct = null;
let activePhotoIndex = 0;

// =====================================================================
// UTILIDADES
// =====================================================================
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatPrice(amount, currency) {
    const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD"
    }).format(Number(amount) || 0);
    return `${formatted} ${currency || "USD"}`;
}

// Convierte una fila de la base de datos al formato que usa la interfaz
function normalizeProduct(row) {
    const photos = Array.isArray(row.photos) && row.photos.length ? row.photos : [PLACEHOLDER_IMG];
    return {
        id: row.id,
        title: row.title,
        category: row.category,
        shortDesc: row.short_desc,
        longDesc: row.long_desc,
        price: formatPrice(row.price, row.currency),
        measures: row.measures,
        material: row.material,
        style: row.style,
        warranty: row.warranty,
        photos
    };
}

// =====================================================================
// DATOS
// =====================================================================
async function loadProducts() {
    const { data, error } = await db
        .from("products")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

    if (error) throw error;
    return data.map(normalizeProduct);
}

// =====================================================================
// RENDER
// =====================================================================
function renderCard(p) {
    return `
        <div class="bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-xl transition duration-300 flex flex-col justify-between group">
            <div class="relative overflow-hidden aspect-[4/3] bg-neutral-100">
                <img src="${escapeHtml(p.photos[0])}" alt="${escapeHtml(p.title)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" onerror="this.src='${PLACEHOLDER_IMG}'">
                <div class="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-neutral-900 text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider shadow-sm">
                    ${escapeHtml(p.category)}
                </div>
            </div>
            <div class="p-5 flex flex-col flex-grow justify-between space-y-4">
                <div class="space-y-2">
                    <h4 class="text-lg font-bold text-neutral-900 leading-snug group-hover:text-[#c89e6a] transition">${escapeHtml(p.title)}</h4>
                    <p class="text-xs text-neutral-600 line-clamp-2 leading-relaxed">${escapeHtml(p.shortDesc)}</p>
                </div>
                <div class="pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <span class="text-base font-extrabold text-neutral-900">${escapeHtml(p.price)}</span>
                    <button data-product-id="${p.id}" class="inline-flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-900 bg-neutral-100 hover:bg-neutral-900 hover:text-white px-3.5 py-2 rounded-lg transition duration-200">
                        <span>Ver detalles</span>
                        <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderCategories() {
    const categories = ["Todos", ...new Set(products.map(p => p.category))];
    const container = document.getElementById("category-filters");

    container.innerHTML = categories.map(cat => `
        <button data-category="${escapeHtml(cat)}"
            class="category-btn whitespace-nowrap px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition shadow-sm ${currentFilter === cat ? "bg-[#1a1a1a] text-white" : "bg-white text-neutral-700 hover:bg-neutral-200 border border-neutral-300"}">
            ${escapeHtml(cat)}
        </button>
    `).join("");
}

function renderProducts() {
    const grid = document.getElementById("products-grid");
    const countLabel = document.getElementById("product-count");

    const filtered = currentFilter === "Todos"
        ? products
        : products.filter(p => p.category === currentFilter);

    countLabel.textContent = `Mostrando ${filtered.length} productos`;

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-neutral-500">No se encontraron productos en esta categoría.</div>`;
        return;
    }

    grid.innerHTML = filtered.map(renderCard).join("");
}

function renderLoading() {
    document.getElementById("product-count").textContent = "Cargando productos...";
    document.getElementById("products-grid").innerHTML = `
        <div class="col-span-full py-16 text-center text-neutral-500">
            <i class="fa-solid fa-circle-notch fa-spin text-2xl text-[#c89e6a]"></i>
        </div>`;
}

function renderError() {
    document.getElementById("product-count").textContent = "";
    document.getElementById("products-grid").innerHTML = `
        <div class="col-span-full py-16 text-center space-y-3">
            <p class="text-neutral-700 font-medium">No pudimos cargar el catálogo en este momento.</p>
            <button id="retry-load" class="bg-[#1a1a1a] hover:bg-[#c89e6a] text-white text-sm font-medium px-5 py-2.5 rounded-lg transition">
                Reintentar
            </button>
        </div>`;
    document.getElementById("retry-load").addEventListener("click", init);
}

// =====================================================================
// MODAL
// =====================================================================
function openProductModal(id) {
    activeProduct = products.find(p => p.id === id);
    if (!activeProduct) return;

    activePhotoIndex = 0;
    updateModalContent();

    document.getElementById("product-modal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeModal() {
    document.getElementById("product-modal").classList.add("hidden");
    document.body.style.overflow = "auto";
}

function updateModalContent() {
    if (!activeProduct) return;
    const p = activeProduct;

    document.getElementById("modal-category").textContent = p.category;
    document.getElementById("modal-title").textContent = p.title;
    document.getElementById("modal-price").textContent = p.price;
    document.getElementById("modal-short-desc").textContent = p.shortDesc;
    document.getElementById("modal-long-desc").textContent = p.longDesc;

    document.getElementById("specs-table-body").innerHTML = `
        <tr>
            <td class="px-4 py-3 font-semibold text-neutral-700 bg-neutral-50 w-1/3">Medidas</td>
            <td class="px-4 py-3 text-neutral-600">${escapeHtml(p.measures)}</td>
        </tr>
        <tr>
            <td class="px-4 py-3 font-semibold text-neutral-700 bg-neutral-50">Material</td>
            <td class="px-4 py-3 text-neutral-600">${escapeHtml(p.material)}</td>
        </tr>
        <tr>
            <td class="px-4 py-3 font-semibold text-neutral-700 bg-neutral-50">Estilo</td>
            <td class="px-4 py-3 text-neutral-600">${escapeHtml(p.style)}</td>
        </tr>
        <tr>
            <td class="px-4 py-3 font-semibold text-neutral-700 bg-neutral-50">Garantía</td>
            <td class="px-4 py-3 text-neutral-600">${escapeHtml(p.warranty)}</td>
        </tr>
    `;

    renderThumbnails();
    setAngle(0);

    const waMsg = encodeURIComponent(`Hola, me interesa cotizar el producto "${p.title}" (${p.price}) visto en el catálogo industrial.`);
    document.getElementById("btn-order").onclick = () => {
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${waMsg}`, "_blank");
    };
}

function renderThumbnails() {
    document.getElementById("modal-thumbnails").innerHTML = activeProduct.photos.map((photo, index) => `
        <button data-angle="${index}" class="relative rounded-lg overflow-hidden aspect-video border-2 transition">
            <img src="${escapeHtml(photo)}" alt="Ángulo ${index + 1}" class="w-full h-full object-cover" onerror="this.src='${PLACEHOLDER_IMG}'">
        </button>
    `).join("");
}

function setAngle(index) {
    if (!activeProduct) return;
    activePhotoIndex = index;

    const mainImage = document.getElementById("modal-main-image");
    mainImage.src = activeProduct.photos[index];
    document.getElementById("angle-indicator").textContent = `Ángulo ${index + 1} / ${activeProduct.photos.length}`;

    document.querySelectorAll("#modal-thumbnails button").forEach((btn, idx) => {
        btn.className = idx === index
            ? "relative rounded-lg overflow-hidden aspect-video border-2 border-[#c89e6a] ring-2 ring-[#c89e6a]/30 transition"
            : "relative rounded-lg overflow-hidden aspect-video border-2 border-transparent opacity-70 hover:opacity-100 transition";
    });
}

function stepAngle(delta) {
    if (!activeProduct) return;
    const total = activeProduct.photos.length;
    setAngle((activePhotoIndex + delta + total) % total);
}

// =====================================================================
// EVENTOS
// =====================================================================
function setupEventListeners() {
    // Filtros de categoría (delegación)
    document.getElementById("category-filters").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-category]");
        if (!btn) return;
        currentFilter = btn.dataset.category;
        renderCategories();
        renderProducts();
    });

    // Botón "Ver detalles" (delegación)
    document.getElementById("products-grid").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-product-id]");
        if (!btn) return;
        openProductModal(Number(btn.dataset.productId));
    });

    // Miniaturas (delegación)
    document.getElementById("modal-thumbnails").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-angle]");
        if (!btn) return;
        setAngle(Number(btn.dataset.angle));
    });

    // Modal: cerrar y navegar
    const modal = document.getElementById("product-modal");
    document.getElementById("close-modal").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
    document.getElementById("prev-angle").addEventListener("click", () => stepAngle(-1));
    document.getElementById("next-angle").addEventListener("click", () => stepAngle(1));

        // Menú móvil (opcional)
    const mobileMenu = document.getElementById("mobile-menu");
    const mobileMenuBtn = document.getElementById("mobile-menu-btn");
    if (mobileMenu && mobileMenuBtn) {
        mobileMenuBtn.addEventListener("click", () => mobileMenu.classList.toggle("hidden"));
        mobileMenu.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => mobileMenu.classList.add("hidden"));
        });
    }
}
    
// =====================================================================
// INICIO
// =====================================================================
async function init() {
    renderLoading();
    try {
        products = await loadProducts();
        renderCategories();
        renderProducts();
    } catch (err) {
        console.error("Error cargando productos:", err);
        renderError();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    init();
});