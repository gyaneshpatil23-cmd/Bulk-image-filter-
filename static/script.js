// =====================
// CONFIG
// =====================
const PRESETS = [
    { id: "original", label: "Original", filter: "" },
    { id: "grayscale", label: "Grayscale", filter: "grayscale(100%)", thumb: "grayscale.webp" },
    { id: "sepia", label: "Sepia", filter: "sepia(100%)", thumb: "sepia.jpg" },
    { id: "blur", label: "Blur", filter: "blur(3px)", thumb: "blur.jpg" },
    { id: "bright", label: "Bright", filter: "brightness(150%)", thumb: "bright.avif" },
    { id: "contrast", label: "Contrast", filter: "contrast(200%)", thumb: "contrast.png" },
    { id: "bluehaze", label: "Bluehaze", filter: "brightness(83%) contrast(112%) saturate(92%) hue-rotate(210deg)", thumb: "bluedaze.jpg", filterThumb: true },
    { id: "cinematicwarm", label: "Cinematic Warm", filter: "brightness(95%) contrast(115%) saturate(110%) hue-rotate(-20deg)", thumb: "cinematicwarm.jpg", filterThumb: true },
    { id: "moodydark", label: "Moody Dark", filter: "brightness(70%) contrast(130%) saturate(80%)", thumb: "moodydark.jpg", filterThumb: true },
    { id: "fadedfilm", label: "Faded Film", filter: "brightness(105%) contrast(85%) saturate(90%)", thumb: "fadedfilm.jpg", filterThumb: true },
    { id: "softcinematic", label: "Soft Cinematic", filter: "brightness(98%) contrast(105%) saturate(95%) blur(0.3px)", thumb: "softcinematic.jpg", filterThumb: true },
    { id: "goldenhour", label: "Golden Hour", filter: "brightness(110%) contrast(105%) saturate(120%) hue-rotate(-10deg)", thumb: "goldenhour.jpg", filterThumb: true }
];

const SLIDERS = [
    { key: "brightness", label: "Brightness", min: 0, max: 200, def: 100, unit: "%" },
    { key: "contrast", label: "Contrast", min: 0, max: 200, def: 100, unit: "%" },
    { key: "saturation", label: "Saturation", min: 0, max: 200, def: 100, unit: "%" },
    { key: "hue", label: "Hue", min: -180, max: 180, def: 0, unit: "°" },
    { key: "blur", label: "Blur", min: 0, max: 10, step: 0.5, def: 0, unit: "px" }
];

function defaultState() {
    const state = { preset: "original" };
    SLIDERS.forEach(s => state[s.key] = s.def);
    return state;
}


// =====================
// GLOBAL STATE
// =====================
let items = [];                    // { file, url, name, state, wrapper, img }
let selected = null;               // item being edited alone, or null = all images
let globalState = defaultState();  // what "all images" editing shows, and what new images start with

const $ = id => document.getElementById(id);
const imageInput = $("imageInput");
const imageGrid = $("imageGrid");
const dropZone = $("dropZone");


// =====================
// FILTER STRING
// =====================
// blurScale converts blur from thumbnail pixels to full-size pixels on export
function buildFilter(state, blurScale = 1) {
    const preset = PRESETS.find(p => p.id === state.preset);
    const parts = [];

    if (preset && preset.filter) {
        parts.push(preset.filter.replace(/blur\(([\d.]+)px\)/g, (m, px) => `blur(${px * blurScale}px)`));
    }
    if (state.brightness !== 100) parts.push(`brightness(${state.brightness}%)`);
    if (state.contrast !== 100) parts.push(`contrast(${state.contrast}%)`);
    if (state.saturation !== 100) parts.push(`saturate(${state.saturation}%)`);
    if (state.hue !== 0) parts.push(`hue-rotate(${state.hue}deg)`);
    if (state.blur !== 0) parts.push(`blur(${state.blur * blurScale}px)`);

    return parts.join(" ") || "none";
}

function currentState() {
    return selected ? selected.state : globalState;
}

// Change the image being edited, or every image when none is selected
function updateState(changes) {
    if (selected) {
        Object.assign(selected.state, changes);
        selected.img.style.filter = buildFilter(selected.state);
    } else {
        Object.assign(globalState, changes);
        items.forEach(item => {
            Object.assign(item.state, changes);
            item.img.style.filter = buildFilter(item.state);
        });
    }
    syncPanel();
}


// =====================
// LOAD IMAGES
// =====================
function addFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith("image/"));

    if (files.length === 0) {
        if (fileList.length > 0) showToast("Those files aren't images.");
        return;
    }

    files.forEach(file => {
        const item = {
            file,
            url: URL.createObjectURL(file),
            name: file.name,
            state: { ...globalState }
        };

        const wrapper = document.createElement("div");
        wrapper.className = "img-wrapper";
        wrapper.tabIndex = 0;
        wrapper.setAttribute("role", "button");
        wrapper.title = file.name;

        const img = document.createElement("img");
        img.src = item.url;
        img.alt = file.name;
        img.style.filter = buildFilter(item.state);
        img.onerror = () => {
            removeItem(item);
            showToast(`Couldn't open ${file.name}`);
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "delete-btn";
        deleteBtn.textContent = "×";
        deleteBtn.setAttribute("aria-label", `Remove ${file.name}`);
        deleteBtn.onclick = e => {
            e.stopPropagation();
            removeItem(item);
        };

        wrapper.onclick = () => selectItem(selected === item ? null : item);
        wrapper.onkeydown = e => {
            if (e.target === wrapper && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                wrapper.click();
            }
        };

        wrapper.appendChild(img);
        wrapper.appendChild(deleteBtn);
        imageGrid.appendChild(wrapper);

        item.wrapper = wrapper;
        item.img = img;
        items.push(item);
    });

    syncPanel();
}

function removeItem(item) {
    if (!items.includes(item)) return;

    items = items.filter(i => i !== item);
    item.wrapper.remove();
    URL.revokeObjectURL(item.url);

    if (selected === item) selected = null;
    syncPanel();
}

function selectItem(item) {
    selected = item;
    syncPanel();
}

imageInput.addEventListener("change", function () {
    addFiles(this.files);
    this.value = ""; // lets the same file be picked again
});

$("addBtn").addEventListener("click", () => imageInput.click());

// Drag and drop
["dragenter", "dragover"].forEach(type => {
    dropZone.addEventListener(type, e => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });
});

["dragleave", "drop"].forEach(type => {
    dropZone.addEventListener(type, e => {
        e.preventDefault();
        if (type === "drop" || !dropZone.contains(e.relatedTarget)) {
            dropZone.classList.remove("drag-over");
        }
    });
});

dropZone.addEventListener("drop", e => addFiles(e.dataTransfer.files));


// =====================
// SIDE PANEL
// =====================
function buildPanel() {
    const filterPanel = $("filterPanel");

    PRESETS.forEach(preset => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filter-btn";
        btn.dataset.preset = preset.id;

        const thumb = document.createElement("span");
        thumb.className = "filter-thumb";
        if (preset.thumb) {
            thumb.style.backgroundImage = `url("static/${preset.thumb}")`;
            if (preset.filterThumb) thumb.style.filter = preset.filter;
        }

        const label = document.createElement("span");
        label.className = "filter-label";
        label.textContent = preset.label;

        btn.appendChild(thumb);
        btn.appendChild(label);
        btn.onclick = () => updateState({ preset: preset.id });
        filterPanel.appendChild(btn);
    });

    const sliderPanel = $("sliderPanel");

    SLIDERS.forEach(slider => {
        const row = document.createElement("div");
        row.className = "slider-row";

        const label = document.createElement("label");
        label.htmlFor = slider.key;
        label.textContent = slider.label;

        const value = document.createElement("output");
        value.id = slider.key + "Value";

        const input = document.createElement("input");
        input.type = "range";
        input.id = slider.key;
        input.min = slider.min;
        input.max = slider.max;
        input.step = slider.step || 1;
        input.value = slider.def;
        input.oninput = () => updateState({ [slider.key]: +input.value });

        row.appendChild(label);
        row.appendChild(value);
        row.appendChild(input);
        sliderPanel.appendChild(row);
    });
}

// Make the panel reflect whatever is currently being edited
function syncPanel() {
    const state = currentState();
    const hasImages = items.length > 0;

    $("editControls").disabled = !hasImages;
    $("downloadBtn").disabled = !hasImages;
    $("emptyState").hidden = hasImages;
    $("editAllBtn").hidden = !selected;

    if (!hasImages) {
        $("targetLabel").textContent = "No images yet";
    } else if (selected) {
        $("targetLabel").textContent = "Editing: " + selected.name;
    } else {
        $("targetLabel").textContent = items.length === 1 ? "Editing 1 image" : `Editing all ${items.length} images`;
    }

    items.forEach(item => item.wrapper.classList.toggle("active-img", item === selected));

    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.preset === state.preset);
    });

    SLIDERS.forEach(slider => {
        $(slider.key).value = state[slider.key];
        $(slider.key + "Value").textContent = state[slider.key] + slider.unit;
    });
}

$("editAllBtn").addEventListener("click", () => selectItem(null));
$("resetBtn").addEventListener("click", () => updateState(defaultState()));


// =====================
// DOWNLOAD
// =====================
function renderItem(item) {
    return new Promise((resolve, reject) => {
        const img = item.img;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        // thumbnails are shown with object-fit: contain
        const shown = Math.min(img.clientWidth / img.naturalWidth, img.clientHeight / img.naturalHeight);
        const blurScale = shown > 0 ? 1 / shown : 1;

        ctx.filter = buildFilter(item.state, blurScale);
        ctx.drawImage(img, 0, 0);

        const isJpeg = item.file.type === "image/jpeg";
        canvas.toBlob(
            blob => blob ? resolve(blob) : reject(new Error("Could not render " + item.name)),
            isJpeg ? "image/jpeg" : "image/png",
            0.92
        );
    });
}

function outputName(item, used) {
    const isJpeg = item.file.type === "image/jpeg";
    const base = item.name.replace(/\.[^.]+$/, "") || "image";
    const ext = isJpeg ? ".jpg" : ".png";

    let name = base + ext;
    for (let n = 2; used.has(name.toLowerCase()); n++) {
        name = `${base}-${n}${ext}`;
    }
    used.add(name.toLowerCase());
    return name;
}

function saveBlob(blob, filename) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function downloadImages() {
    if (items.length === 0) return;

    if (!("filter" in CanvasRenderingContext2D.prototype)) {
        showToast("This browser can't export filtered images. Try Chrome, Edge or Firefox.");
        return;
    }
    if (items.length > 1 && typeof JSZip === "undefined") {
        showToast("Couldn't load the zip library. Check your connection and reload.");
        return;
    }

    const btn = $("downloadBtn");
    btn.disabled = true;
    btn.textContent = "Preparing…";

    try {
        const used = new Set();

        if (items.length === 1) {
            saveBlob(await renderItem(items[0]), outputName(items[0], used));
        } else {
            const zip = new JSZip();
            const folder = zip.folder("filtered-images");

            // one at a time keeps memory down with large batches
            for (const item of items.slice()) {
                folder.file(outputName(item, used), await renderItem(item));
            }

            saveBlob(await zip.generateAsync({ type: "blob" }), "filtered-images.zip");
        }
    } catch (err) {
        console.error(err);
        showToast("Download failed: " + err.message);
    } finally {
        btn.textContent = "Download";
        btn.disabled = items.length === 0;
    }
}

$("downloadBtn").addEventListener("click", downloadImages);


// =====================
// TOAST
// =====================
let toastTimer;

function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}


buildPanel();
syncPanel();
