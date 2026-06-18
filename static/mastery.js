const BACKEND_URL = "";

let masteryData = [];
let currentSortKey = "";
let isAscending = true;
let masterySimulation = null;

// ── 1. DEFAULT-TAB AUF GRAPH SETZEN ──
document.addEventListener("DOMContentLoaded", () => {
  const relationsBtn = document.getElementById("btn-relations-tab");
  if (relationsBtn) {
    openTab("relations-tab", relationsBtn);
  }
});

function openTab(tabId, btn) {
  document
    .querySelectorAll(".tab-content")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".tab-button")
    .forEach((b) => b.classList.remove("active"));

  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add("active");
  if (btn) btn.classList.add("active");

  // Lore-Graphen initialisieren
  if (
    tabId === "relations-tab" &&
    typeof initLoreGraph === "function" &&
    !window.isGraphInitialized
  ) {
    initLoreGraph();
  }

  if (tabId === "mastery-tab" && masterySimulation) {
    masterySimulation.alpha(0.3).restart();
  }
}

async function fetchMastery() {
  const name = document.getElementById("gameName").value.trim();
  const tag = document.getElementById("tagLine").value.trim();
  const routing = document.getElementById("routingRegion").value;
  const platform = document.getElementById("platformRegion").value;

  const loading = document.getElementById("loading");
  const dashboard = document.getElementById("masteryDashboard");

  if (!name || !tag)
    return alert("Please enter both a Game Name and a Tag Line!");

  loading.style.display = "block";
  dashboard.style.display = "none";

  try {
    const url = `${BACKEND_URL}/api/mastery?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}&routing=${routing}&platform=${platform}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(
        errData.error || "An error occurred while fetching data.",
      );
    }

    masteryData = await response.json();

    renderMasteryBubbles();
    renderTable();

    loading.style.display = "none";
    dashboard.style.display = "block";
  } catch (error) {
    alert(error.message);
    loading.style.display = "none";
  }
}

// ── 2. D3 MASTERY-BUBBLE-GRAPH ──
function renderMasteryBubbles() {
  const containerId = "masteryBubbleContainer";
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  if (masteryData.length === 0) return;
  const maxPoints = Math.max(...masteryData.map((c) => c.championPoints), 1);

  const nodes = masteryData.map((champ) => {
    const minRadius = 15;
    const maxRadius = 75;
    const radius =
      minRadius + (champ.championPoints / maxPoints) * (maxRadius - minRadius);
    const mass = 1 + (champ.championPoints / maxPoints) * 14;

    let cdnName = champ.championName.replace(/[^a-zA-Z0-9]/g, "");
    if (cdnName === "Wukong") cdnName = "MonkeyKing";

    return {
      id: champ.championName,
      name: champ.championName,
      points: champ.championPoints,
      level: champ.championLevel,
      lastPlayed: champ.lastPlayTime,
      radius: radius,
      mass: mass,
      // Fallback-Sicherer ddragon Link ohne hängende Versionsnummer falls möglich, oder passend zum neuesten Stand
      imgUrl: `https://ddragon.leagueoflegends.com/cdn/14.3.1/img/champion/${cdnName}.png`,
      x:
        champ.championPoints > maxPoints * 0.15
          ? width / 2 + (Math.random() - 0.5) * 40
          : width / 2 + (Math.random() - 0.5) * 500,
      y:
        champ.championPoints > maxPoints * 0.15
          ? height / 2 + (Math.random() - 0.5) * 40
          : height / 2 + (Math.random() - 0.5) * 500,
    };
  });

  const svg = d3
    .select(`#${containerId}`)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .style("cursor", "move");

  const mainGroup = svg.append("g");
  const defs = svg.append("defs");

  nodes.forEach((node) => {
    defs
      .append("pattern")
      .attr("id", `pattern-${node.id.replace(/[^a-zA-Z0-9]/g, "")}`)
      .attr("width", 1)
      .attr("height", 1)
      .append("image")
      .attr("xlink:href", node.imgUrl)
      .attr("width", node.radius * 2)
      .attr("height", node.radius * 2)
      .attr("x", 0)
      .attr("y", 0);
  });

  const zoomBehavior = d3
    .zoom()
    .scaleExtent([0.15, 5])
    .on("zoom", (event) => {
      mainGroup.attr("transform", event.transform);
    });

  svg.call(zoomBehavior);

  masterySimulation = d3
    .forceSimulation(nodes)
    .force("x", d3.forceX(width / 2).strength(0.05))
    .force("y", d3.forceY(height / 2).strength(0.05))
    .force(
      "collision",
      d3
        .forceCollide()
        .radius((d) => d.radius + 1.5)
        .strength(0.8)
        .iterations(4),
    )
    .alphaDecay(0.025);

  const bubbles = mainGroup
    .append("g")
    .selectAll("circle")
    .data(nodes)
    .enter()
    .append("circle")
    .attr("r", (d) => d.radius)
    .attr("fill", (d) => `url(#pattern-${d.id.replace(/[^a-zA-Z0-9]/g, "")})`)
    .attr("stroke", (d) => (d.points > 0 ? "#007bff" : "#3c3c3c"))
    .attr("stroke-width", 3)
    .style("cursor", "grab");

  const labels = mainGroup
    .append("g")
    .selectAll("text")
    .data(nodes)
    .enter()
    .append("text")
    .filter((d) => d.radius > 35)
    .text((d) => d.name)
    .attr("text-anchor", "middle")
    .attr("dy", (d) => d.radius + 15)
    .attr("fill", "#ffffff")
    .style("font-family", "sans-serif")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("pointer-events", "none")
    .style("text-shadow", "2px 2px 4px #000000");

  const tooltipDiv = d3.select("body").selectAll(".vis-tooltip").empty()
    ? d3
        .select("body")
        .append("div")
        .attr("class", "vis-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
    : d3.select(".vis-tooltip");

  bubbles
    .on("mouseover", function (event, d) {
      d3.select(this).attr("stroke", "#0ac8b9").attr("stroke-width", 5);
      tooltipDiv.style("visibility", "visible").html(`
                <strong>${d.name}</strong><br/>
                Level: ${d.level}<br/>
                Points: ${d.points.toLocaleString()}<br/>
                Last Played: ${d.lastPlayed}
            `);
    })
    .on("mousemove", function (event) {
      tooltipDiv
        .style("top", event.pageY - 15 + "px")
        .style("left", event.pageX + 15 + "px");
    })
    .on("mouseleave", function () {
      d3.select(this)
        .attr("stroke", (d) => (d.points > 0 ? "#007bff" : "#3c3c3c"))
        .attr("stroke-width", 3);
      tooltipDiv.style("visibility", "hidden");
    });

  bubbles.call(
    d3
      .drag()
      .on("start", (event, d) => {
        if (!event.active) masterySimulation.alphaTarget(0.2).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        const transform = d3.zoomTransform(svg.node());
        d.fx = (event.x - transform.x) / transform.k;
        d.fy = (event.y - transform.y) / transform.k;
      })
      .on("end", (event, d) => {
        if (!event.active) masterySimulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }),
  );

  masterySimulation.on("tick", () => {
    nodes.forEach((d) => {
      if (d.fx === null) {
        d.vx += (width / 2 - d.x) * 0.0008 * (1 / d.mass);
        d.vy += (height / 2 - d.y) * 0.0008 * (1 / d.mass);
      }
    });

    bubbles.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
    labels.attr("x", (d) => d.x).attr("y", (d) => d.y);
  });
}

function renderTable() {
  const tbody = document.getElementById("tableBody");
  if (!tbody) return;
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

// Global machen, damit HTML Onclick es findet
window.sortTable = function (key) {
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
};

window.fetchMastery = fetchMastery;
window.openTab = openTab;
