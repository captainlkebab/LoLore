let isGraphInitialized = false;
let networkNodes = null;
let networkEdges = null;
let rawNodesData = [];
let connectionCounts = {};

const factionColors = {
  demacia: "#93b2cc",
  noxus: "#912d2d",
  ionia: "#dc92b6",
  shadow_isles: "#00ffcc",
  zaun: "#7fff00",
  piltover: "#eec590",
  freljord: "#86d2f3",
  shurima: "#e5c158",
  targon: "#565ca9",
  ixtal: "#1ca673",
  void: "#8932a8",
  bilgewater: "#c45d31",
  runeterra: "#007bff",
};

function initLoreGraph() {
  isGraphInitialized = true;

  fetch("/static/relationship_model.json")
    .then((response) => {
      if (!response.ok) throw new Error("Modell-Datei nicht gefunden.");
      return response.json();
    })
    .then((data) => {
      rawNodesData = data.nodes;

      buildDynamicFactionUI(rawNodesData);

      connectionCounts = {};
      rawNodesData.forEach((n) => (connectionCounts[n.id] = 0));
      data.edges.forEach((edge) => {
        if (connectionCounts[edge.source] !== undefined)
          connectionCounts[edge.source]++;
        if (connectionCounts[edge.target] !== undefined)
          connectionCounts[edge.target]++;
      });

      const maxConnections = Math.max(...Object.values(connectionCounts), 1);
      const slider = document.getElementById("filterConnections");
      if (slider) slider.max = maxConnections;

      const formattedNodes = data.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        shape: "circularImage",
        image: node.image || "https://via.placeholder.com/150",
        size: 24,
        borderWidth: 2,
        color: {
          border: getColorByFaction(node.faction),
          background: "#191919",
          highlight: { border: "#007bff", background: "#252525" },
        },
        font: {
          color: "#ffffff",
          size: 11,
          strokeWidth: 3,
          strokeColor: "#121212",
        },
      }));

      const formattedEdges = data.edges.map((edge) => {
        const sourceNode = data.nodes.find((n) => n.id === edge.source);
        const edgeColor = sourceNode
          ? getColorByFaction(sourceNode.faction)
          : "#444444";

        return {
          id: edge.id,
          from: edge.source,
          to: edge.target,
          arrows: edge.type === "directed" ? "to" : "",
          color: {
            color: edgeColor,
            highlight: "#007bff",
            hover: "#666666",
            opacity: 0.4,
          },
          width: edge.type === "mutual" ? 2 : 1,
        };
      });

      const container = document.getElementById("mynetwork");
      networkNodes = new vis.DataSet(formattedNodes);
      networkEdges = new vis.DataSet(formattedEdges);

      const graphData = { nodes: networkNodes, edges: networkEdges };

      const options = {
        physics: {
          enabled: true,
          solver: "forceAtlas2Based",
          forceAtlas2Based: {
            gravitationalConstant: -150,
            centralGravity: 0.05,
            springLength: 40,
            springConstant: 0.06,
            avoidOverlap: 1,
          },
          stabilization: {
            enabled: true,
            iterations: 100,
            updateInterval: 25,
          },
        },
        interaction: {
          hover: false,
          dragNodes: false,
          zoomView: true,
          dragView: true,
          hideEdgesOnDrag: true,
          hideEdgesOnZoom: true,
        },
        nodes: {
          shapeProperties: {
            interpolation: false,
          },
        },
      };

      const network = new vis.Network(container, graphData, options);

      network.once("stabilizationIterationsDone", function () {
        network.setOptions({ physics: false });
        console.log("Performance-Mode: Physik im File graph.js eingefroren.");
      });

      // ⚡ NEU: Performance-Schutz beim Zoomen
      network.on("zoom", function (params) {
        const currentZoom = network.getScale();

        // Wenn wir weit rauszoomen (< 0.5), blenden wir die Labels aus
        if (currentZoom < 0.5) {
          network.setOptions({
            nodes: {
              font: { size: 0 }, // Schaltet das Zeichnen der Schrift komplett ab
            },
          });
        } else {
          network.setOptions({
            nodes: {
              font: { size: 11 }, // Standardgröße, wenn man nah genug dran ist
            },
          });
        }
      });

      network.on("click", function (params) {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const champion = rawNodesData.find((n) => n.id === nodeId);

          if (champion) {
            document.getElementById("modalImg").src =
              champion.image || "https://via.placeholder.com/150";
            document.getElementById("modalName").innerText =
              champion.label || champion.id;
            document.getElementById("modalTitle").innerText =
              champion.title || "The Champion";
            document.getElementById("modalFaction").innerText =
              normalizeFactionName(champion.faction);
            document.getElementById("modalConnections").innerText =
              connectionCounts[champion.id] || 0;
            document.getElementById("modalRoles").innerText = champion.roles
              ? champion.roles.join(", ")
              : "Unknown";
            document.getElementById("modalRelease").innerText =
              champion.release_date || "Unknown";

            const tooltip = document.getElementById("championModal");
            tooltip.style.left = params.pointer.DOM.x + 15 + "px";
            tooltip.style.top = params.pointer.DOM.y + 15 + "px";
            tooltip.style.display = "block";
          }
        } else {
          document.getElementById("championModal").style.display = "none";
        }
      });

      network.on("dragStart", function () {
        document.getElementById("championModal").style.display = "none";
      });

      applyFilters();
    })
    .catch((error) => {
      console.error("Fehler beim Laden des Beziehungsmodells:", error);
    });
}

function applyFilters() {
  if (!networkNodes || !networkEdges) return;

  const selectedFaction = document.getElementById("filterFaction").value;
  const minConnections =
    parseInt(document.getElementById("filterConnections").value, 10) || 0;
  const isFactionFilterActive = selectedFaction !== "all";

  const updatedNodes = rawNodesData.map((node) => {
    const cleanedFaction = cleanFactionString(node.faction);
    const connections = connectionCounts[node.id] || 0;

    const matchesFaction =
      !isFactionFilterActive || cleanedFaction === selectedFaction;
    const matchesConnections = connections >= minConnections;
    const isMatch = matchesFaction && matchesConnections;

    const factionColor = getColorByFaction(node.faction);
    const targetSize = isFactionFilterActive && isMatch ? 72 : 24;

    let borderColor = factionColor;
    let fontColor = "#ffffff";

    if (!isMatch) {
      borderColor = "rgba(85, 85, 85, 0.2)";
      fontColor = "rgba(255, 255, 255, 0.2)";
    }

    return {
      id: node.id,
      size: targetSize,
      hidden: false,
      color: {
        border: borderColor,
        background: !isMatch ? "rgba(25, 25, 25, 0.2)" : "#191919",
        highlight: { border: "#007bff", background: "#252525" },
      },
      font: { color: fontColor },
    };
  });

  networkNodes.update(updatedNodes);

  const currentNodesView = networkNodes.get();
  const fadedNodeIds = new Set(
    currentNodesView
      .filter((n) => n.font && n.font.color.includes("rgba"))
      .map((n) => n.id),
  );

  const updatedEdges = networkEdges.get().map((edge) => {
    const sourceNode = rawNodesData.find((n) => n.id === edge.from);
    const baseColor = sourceNode
      ? getColorByFaction(sourceNode.faction)
      : "#444444";
    const shouldFadeEdge =
      fadedNodeIds.has(edge.from) || fadedNodeIds.has(edge.to);

    return {
      id: edge.id,
      hidden: false,
      color: {
        color: shouldFadeEdge ? "rgba(68, 68, 68, 0.1)" : baseColor,
        opacity: shouldFadeEdge ? 0.1 : 0.6,
      },
    };
  });

  networkEdges.update(updatedEdges);
}

function buildDynamicFactionUI(nodes) {
  const uniqueFactions = new Set();
  nodes.forEach((node) => {
    if (node.faction) {
      uniqueFactions.add(cleanFactionString(node.faction));
    }
  });

  const select = document.getElementById("filterFaction");
  const legend = document.getElementById("dynamicLegend");

  select.innerHTML = '<option value="all">All Factions</option>';
  legend.innerHTML = "";

  const sortedFactions = Array.from(uniqueFactions).sort();

  sortedFactions.forEach((faction) => {
    const readableName = normalizeFactionName(faction);
    const color = getColorByFaction(faction);

    const option = document.createElement("option");
    option.value = faction;
    option.textContent = readableName;
    select.appendChild(option);

    const legendItem = document.createElement("div");
    legendItem.style.display = "flex";
    legendItem.style.alignItems = "center";
    legendItem.style.gap = "6px";
    legendItem.innerHTML = `<span style="width:12px; height:12px; background:${color}; border-radius:50%; display:inline-block;"></span> ${readableName}`;
    legend.appendChild(legendItem);
  });
}

function generateRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Global sichtbare Utility-Funktionen belassen, falls app.js darauf zugreifen muss
function getColorByFaction(faction) {
  const cleaned = cleanFactionString(faction);
  if (!factionColors[cleaned]) {
    factionColors[cleaned] = generateRandomColor();
  }
  return factionColors[cleaned];
}

function cleanFactionString(faction) {
  if (!faction) return "runeterra";
  let f = faction.toLowerCase().trim();
  if (f === "shadow-isles" || f === "shadow_isles") return "shadow_isles";
  if (f === "unaffiliated" || f === "runeterra") return "runeterra";
  return f;
}

function normalizeFactionName(faction) {
  const names = {
    demacia: "Demacia",
    noxus: "Noxus",
    ionia: "Ionia",
    freljord: "Freljord",
    piltover: "Piltover",
    zaun: "Zaun",
    shadow_isles: "Shadow Isles",
    runeterra: "Runeterra / Unaffiliated",
    shurima: "Shurima",
    targon: "Mount Targon",
    ixtal: "Ixtal",
    void: "The Void",
    bilgewater: "Bilgewater",
  };

  if (names[faction]) return names[faction];
  const cleaned = cleanFactionString(faction);
  return names[cleaned] || cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
