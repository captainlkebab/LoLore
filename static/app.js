const BACKEND_URL = "";

let masteryData = [];
let currentSortKey = "";
let isAscending = true;

function openTab(tabId, btn) {
    document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-button").forEach((b) => b.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");
    btn.classList.add("active");

    // Falls die graph.js bereitsteht, initialisiere das Netzwerk beim Klick auf den Tab
    if (tabId === "relations-tab" && typeof initLoreGraph === "function" && !isGraphInitialized) {
        initLoreGraph();
    }
}

async function fetchMastery() {
    const name = document.getElementById("gameName").value.trim();
    const tag = document.getElementById("tagLine").value.trim();
    const routing = document.getElementById("routingRegion").value;
    const platform = document.getElementById("platformRegion").value;

    const loading = document.getElementById("loading");
    const dashboard = document.getElementById("masteryDashboard");

    if (!name || !tag) return alert("Please enter both a Game Name and a Tag Line!");

    loading.style.display = "block";
    dashboard.style.display = "none";

    try {
        const url = `${BACKEND_URL}/api/mastery?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}&routing=${routing}&platform=${platform}`;
        const response = await fetch(url);

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "An error occurred while fetching data.");
        }

        masteryData = await response.json();
        buildDashboardGroups();
        renderTable();

        loading.style.display = "none";
        dashboard.style.display = "block";
    } catch (error) {
        alert(error.message);
        loading.style.display = "none";
    }
}

function buildDashboardGroups() {
    const playedChamps = masteryData.filter((c) => c.championPoints > 0);
    const neverPlayedChamps = masteryData.filter((c) => c.championPoints === 0);
    const mostPlayed = [...playedChamps].sort((a, b) => b.championPoints - a.championPoints).slice(0, 5);
    const leastPlayed = [...playedChamps].sort((a, b) => a.championPoints - b.championPoints).slice(0, 5);
    const closeToLevelUp = playedChamps
        .filter((c) => c.championPointsUntilNextLevel > 0 && c.championPointsUntilNextLevel <= 3000)
        .sort((a, b) => a.championPointsUntilNextLevel - b.championPointsUntilNextLevel);

    fillGrid("mostPlayedGrid", mostPlayed, true);
    fillGrid("leastPlayedGrid", leastPlayed, true);
    fillGrid("neverPlayedGrid", neverPlayedChamps, false);
    fillGrid("closeLevelUpGrid", closeToLevelUp, false, true);
}

function fillGrid(elementId, champions, showPoints, showTokensLeft = false) {
    const grid = document.getElementById(elementId);
    grid.innerHTML = "";

    if (champions.length === 0) {
        grid.innerHTML = '<p style="color: #6c757d; font-style: italic;">No champions found for this category.</p>';
        return;
    }

    champions.forEach((champ) => {
        let detailText = `Lvl ${champ.championLevel}`;
        if (showPoints) detailText += ` | ${champ.championPoints.toLocaleString()} Pts`;
        if (showTokensLeft) detailText += ` | Need: <span style="color: #28a745; font-weight:bold;">${champ.championPointsUntilNextLevel.toLocaleString()}</span>`;

        grid.innerHTML += `
            <div class="champion-card">
                <div class="name">${champ.championName}</div>
                <div class="details">${detailText}</div>
            </div>
        `;
    });
}

function renderTable() {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";
    masteryData.forEach((champ) => {
        tbody.innerHTML += `<tr>
            <td><strong>${champ.championName}</strong></td>
            <td>${champ.championLevel}</td>
            <td>${champ.championPoints.toLocaleString()}</td>
            <td>${champ.championPointsUntilNextLevel.toLocaleString()}</td>
            <td>${champ.lastPlayTime}</td>
        </tr>`;
    });
}

function sortTable(key) {
    if (currentSortKey === key) isAscending = !isAscending;
    else {
        currentSortKey = key;
        isAscending = true;
    }

    masteryData.sort((a, b) => {
        let valA = a[key];
        let valB = b[key];
        if (key === "lastPlayTime") {
            if (valA === "-") return isAscending ? 1 : -1;
            if (valB === "-") return isAscending ? -1 : 1;
        }
        if (typeof valA === "string")
            return isAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
        else return isAscending ? valA - valB : valB - valA;
    });
    renderTable();
}