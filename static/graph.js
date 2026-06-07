let isGraphInitialized = false;
let networkNodes = null;
let networkEdges = null;
let rawNodesData = [];
let connectionCounts = {};

const factionColors = {
  demacia: "#BACAD6",
  noxus: "#C82323",
  ionia: "#E07CA7",
  shadow_isles: "#00FAC8",
  zaun: "#5AD900",
  piltover: "#00A1E6",
  freljord: "#69D2FF",
  shurima: "#F4C430",
  mount_targon: "#7050E0",
  ixtal: "#139A68",
  void: "#D11CE0",
  bilgewater: "#D16815",
  runeterra: "#888888",
  bandle_city: "#1E824C",
};

function initLoreGraph() {
  isGraphInitialized = true;

  fetch("/static/relationship_modelv2.json")
    .then((response) => {
      if (!response.ok) throw new Error("Model Data not found.");
      return response.json();
    })
    .then((data) => {
      rawNodesData = data.nodes;

      // 1. UI-Dropdown & Legende befüllen
      buildDynamicFactionUI(rawNodesData);

      // 2. Verbindungen zählen für den Slider
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

      const formattedNodes = [];

      // ⚡ NEU: Echte Fraktions-Hubs aus data.factions rendern
      data.factions.forEach((faction, index) => {
        const hasImage = faction.image && faction.image !== "";

        const angle = (index / data.factions.length) * 2 * Math.PI;
        const radius = 400;

        formattedNodes.push({
          id: `hub_${faction.id}`,
          label: faction.label,
          shape: hasImage ? "circularImage" : "dot",
          image: hasImage ? faction.image : undefined,
          size: 30, // Normale, solide Größe für einen Hauptknoten
          borderWidth: 3,
          mass: 3, // Leicht erhöht (Standard ist 1), damit sie das Zentrum des Clusters bilden
          physics: true,
          color: {
            border: factionColors[faction.id] || "#888888",
            background: "#121212",
            highlight: { border: "#ffffff", background: "#191919" },
          },
          font: {
            color: "#ffffff",
            size: 14, // Größere Schrift für Regionen
            bold: true,
            strokeWidth: 4,
            strokeColor: "#121212",
          },
        });
      });

      // ⚡ ANPASSUNG: Champion-Nodes verarbeiten
      data.nodes.forEach((node) => {
        // Da 'faction' jetzt ein Array ist, nehmen wir die primäre Fraktion für die Rahmenfarbe
        const primaryFaction =
          node.faction && node.faction.length > 0
            ? node.faction[0]
            : "runeterra";

        formattedNodes.push({
          id: node.id,
          label: node.label,
          shape: "circularImage",
          image: node.image,
          size: 24,
          borderWidth: 2,
          color: {
            border: getColorByFaction(primaryFaction),
            background: "#191919",
            highlight: { border: "#007bff", background: "#252525" },
          },
          font: {
            color: "#ffffff",
            size: 11,
            strokeWidth: 3,
            strokeColor: "#121212",
          },
        });
      });

      // ⚡ ANPASSUNG: Echte Lore-Kanten (Verbindungen zwischen Champions)
      const formattedEdges = data.edges.map((edge) => {
        const sourceNode = data.nodes.find((n) => n.id === edge.source);
        const targetNode = data.nodes.find((n) => n.id === edge.target);

        const srcFaction =
          sourceNode && sourceNode.faction
            ? sourceNode.faction[0]
            : "runeterra";
        const edgeColor = getColorByFaction(srcFaction);

        // Prüfen, ob sie mindestens eine gemeinsame Fraktion haben (Array-Schnittmenge)
        const hasSharedFaction =
          sourceNode &&
          targetNode &&
          sourceNode.faction.some((f) => targetNode.faction.includes(f));

        return {
          id: edge.id,
          from: edge.source,
          to: edge.target,
          arrows: edge.type === "directed" ? "to" : "",
          color: {
            color: edgeColor,
            highlight: "#007bff",
            hover: "#666666",
            opacity: hasSharedFaction ? 0.4 : 0.15,
          },
          width: edge.type === "mutual" ? 2 : 1,
          physics: true,

          // ⚡ ZURÜCK AUF STANDARD: Keine extremen Verkürzungen mehr
          length: undefined, // Nutzt automatisch das springLength (95) aus den Physik-Optionen
          springConstant: undefined, // Nutzt die globale Stärke (0.04)
        };
      });

      // Unsichtbare Magnet-Kanten zu den Hubs
      data.nodes.forEach((node) => {
        if (node.faction && Array.isArray(node.faction)) {
          node.faction.forEach((factionName) => {
            const cleanedFaction = cleanFactionString(factionName);

            formattedEdges.push({
              from: node.id,
              to: `hub_${cleanedFaction}`,
              physics: true,
              length: 50, // Etwas kürzer als normale Kanten, um Cluster zu bilden
              springConstant: 0.04, // Exakt der Standard-Wert
              color: { opacity: 0 },
              interaction: false,
            });
          });
        }
      });

      const container = document.getElementById("mynetwork");
      networkNodes = new vis.DataSet(formattedNodes);
      networkEdges = new vis.DataSet(formattedEdges);

      const graphData = { nodes: networkNodes, edges: networkEdges };

      // Deine ausbalancierten Physik-Einstellungen
      const options = {
        physics: {
          enabled: true,
          solver: "barnesHut",
          barnesHut: {
            gravitationalConstant: -2000, // Standard-Abstoßung der Knoten
            centralGravity: 0.3, // Zieht das gesamte System sanft zur Mitte (Standard)
            springLength: 95, // Standard-Länge für normale Kanten
            springConstant: 0.04, // Standard-Federkraft
            avoidOverlap: 0, // Auf 0 setzen (Standard). Höhere Werte erzeugen oft Jitter!
          },
          stabilization: {
            enabled: true,
            iterations: 1000, // Mehr Iterationen beim Laden, damit es stillsteht, wenn es erscheint
            updateInterval: 50,
          },
        },
        interaction: {
          hover: false,
          dragNodes: true,
          zoomView: true,
          dragView: true,
          hideEdgesOnDrag: false,
          hideEdgesOnZoom: true,
        },
        nodes: {
          shapeProperties: {
            interpolation: false,
          },
        },
      };

      const network = new vis.Network(container, graphData, options);

      // Weit herauszoomen blendet Labels aus (Performance-Schutz)
      network.on("zoom", function (params) {
        const currentZoom = network.getScale();
        if (currentZoom < 0.5) {
          network.setOptions({ nodes: { font: { size: 0 } } });
        } else {
          network.setOptions({ nodes: { font: { size: 11 } } });
        }
      });

      // Klick-Event für das Modal (inklusive neuem Format für Rollen & Release)
      network.on("click", function (params) {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];

          if (nodeId.startsWith("hub_")) {
            // Wenn man auf einen Hub klickt, Modal schließen oder optional Regions-Infos zeigen
            document.getElementById("championModal").style.display = "none";
            return;
          }

          const champion = rawNodesData.find((n) => n.id === nodeId);

          if (champion) {
            document.getElementById("modalImg").src = champion.image || "";
            document.getElementById("modalName").innerText =
              champion.label || champion.id;
            document.getElementById("modalTitle").innerText =
              champion.title || "The Champion";

            // Zeigt alle Factions komma-separiert an
            const factionLabels = champion.faction.map((f) =>
              normalizeFactionName(f),
            );
            document.getElementById("modalFaction").innerText =
              factionLabels.join(", ");

            document.getElementById("modalConnections").innerText =
              connectionCounts[champion.id] || 0;

            // ⚡ NEU: Da Rollen jetzt direkt ein flaches Array ["Fighter", "Tank"] sind:
            document.getElementById("modalRoles").innerText = champion.roles
              ? champion.roles.join(", ")
              : "Unknown";

            // Release-Date sauber kürzen (entfernt die Timestamp-Nullen, falls vorhanden)
            const release = champion.release_date
              ? champion.release_date.split("T")[0]
              : "Unknown";
            document.getElementById("modalRelease").innerText = release;

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
      print("Fehler beim Laden des Beziehungsmodells:", error);
    });
}

function applyFilters() {
  if (!networkNodes || !networkEdges) return;

  const selectedFaction = document.getElementById("filterFaction").value;
  const minConnections =
    parseInt(document.getElementById("filterConnections").value, 10) || 0;
  const isFactionFilterActive = selectedFaction !== "all";

  const updatedNodes = rawNodesData.map((node) => {
    const connections = connectionCounts[node.id] || 0;

    // Prüfen, ob die gewählte Fraktion im Array des Champions existiert
    const matchesFaction =
      !isFactionFilterActive ||
      (node.faction && node.faction.includes(selectedFaction));
    const matchesConnections = connections >= minConnections;
    const isMatch = matchesFaction && matchesConnections;

    const primaryFaction =
      node.faction && node.faction.length > 0 ? node.faction[0] : "runeterra";
    const factionColor = getColorByFaction(primaryFaction);
    const targetSize = isFactionFilterActive && isMatch ? 48 : 24;

    let borderColor = factionColor;
    let fontColor = "#ffffff";

    if (!isMatch) {
      borderColor = "rgba(85, 85, 85, 0.2)";
      fontColor = "rgba(255, 255, 255, 0.2)";
    }

    return {
      id: node.id,
      size: targetSize,
      color: {
        border: borderColor,
        background: !isMatch ? "rgba(25, 25, 25, 0.2)" : "#191919",
      },
      font: { color: fontColor },
    };
  });

  networkNodes.update(updatedNodes);

  // Kanten-Fading
  const currentNodesView = networkNodes.get();
  const fadedNodeIds = new Set(
    currentNodesView
      .filter((n) => n.font && n.font.color && n.font.color.includes("rgba"))
      .map((n) => n.id),
  );

  const updatedEdges = networkEdges.get().map((edge) => {
    if (edge.from.startsWith("hub_") || edge.to.startsWith("hub_")) return edge;

    const sourceNode = rawNodesData.find((n) => n.id === edge.from);
    const srcFaction =
      sourceNode && sourceNode.faction ? sourceNode.faction[0] : "runeterra";
    const baseColor = getColorByFaction(srcFaction);
    const shouldFadeEdge =
      fadedNodeIds.has(edge.from) || fadedNodeIds.has(edge.to);

    return {
      id: edge.id,
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
    if (node.faction && Array.isArray(node.faction)) {
      node.faction.forEach((f) => uniqueFactions.add(cleanFactionString(f)));
    }
  });

  const select = document.getElementById("filterFaction");
  const legend = document.getElementById("dynamicLegend");

  if (!select || !legend) return;

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
  if (f === "mount-targon" || f === "mount_targon" || f === "targon")
    return "mount_targon";
  if (f === "bandle-city" || f === "bandle_city") return "bandle_city";
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
    mount_targon: "Mount Targon",
    ixtal: "Ixtal",
    void: "The Void",
    bilgewater: "Bilgewater",
    bandle_city: "Bandle City",
  };

  if (names[faction]) return names[faction];
  const cleaned = cleanFactionString(faction);
  return names[cleaned] || cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
