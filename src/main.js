import esriConfig from "https://js.arcgis.com/4.27/@arcgis/core/views/MapView.js";
import Map from "https://js.arcgis.com/4.27/@arcgis/core/Map.js";
import SceneView from "https://js.arcgis.com/4.27/@arcgis/core/views/SceneView.js";
import FeatureLayer from "https://js.arcgis.com/4.27/@arcgis/core/layers/FeatureLayer.js";
import SceneLayer from "https://js.arcgis.com/4.27/@arcgis/core/layers/SceneLayer.js";
import Expand from "https://js.arcgis.com/4.27/@arcgis/core/widgets/Expand.js";
import * as reactiveUtils from "https://js.arcgis.com/4.27/@arcgis/core/core/reactiveUtils.js";

// initiallization
esriConfig.apiKey =
	"AAPK5768bdfdf6934d3f9e993b500647accdENViXgjJamoSamjjq4X1Orw00pCFHyN3scHiqRbw5vblcXzfL4WuLL6O06X9MnwF";
const map = new Map({
	basemap: "osm-streets-relief",
	ground: "world-elevation",
});
const view = new SceneView({
	container: "viewDiv",
	map: map,
	camera: {
		position: {
			x: 44.512943, //Longitude
			y: 40.167916, //Latitude
			z: 1400, //Meters
		},
		tilt: 75,
	},
});

// store
const verticalOffset = {
	screenLength: 20,
	maxWorldLength: 200,
	minWorldLength: 35,
};
let busLayerView = null;

// 3D Layers
const buildingsLayer = new SceneLayer({
	url: "https://basemaps3d.arcgis.com/arcgis/rest/services/OpenStreetMap3D_Buildings_v1/SceneServer",
	popupEnabled: false,
	mouseEventsEnabled: false,
});
map.add(buildingsLayer);

// definning Popups
const poiPopup = {
	title: "{name}",
	content: `<b>Category:</b> {category_name}<br><b>Address:</b> {address_name}<br><b>Coordinates:</b> {latitude} N, {longitude} E<br>`,
};
view.popup = {
	dockEnabled: true,
	dockOptions: {
		buttonEnabled: false,
		breakpoint: false,
		position: "bottom-left",
	},
};

// definning Renderers
const poiRenderer = {
	type: "unique-value",
	field: "category_name",
	uniqueValueInfos: null,
};

// 2D Layers
const poiLayer = new FeatureLayer({
	url: "https://services4.arcgis.com/XZEtqni2CM1tP1ZM/ArcGIS/rest/services/YerevanPOIs/FeatureServer/1",
	outFields: ["name", "category_name", "address_name", "telephone", "latitude", "longitude"],
	popupTemplate: poiPopup,
	elevationInfo: {
		mode: "relative-to-scene",
	},
	screenSizePerspectiveEnabled: true,
	featureReduction: {
		type: "selection",
	},
});
const busLayer = new FeatureLayer({
	url: "https://services4.arcgis.com/XZEtqni2CM1tP1ZM/arcgis/rest/services/Bus_Service_WFL1/FeatureServer/1",
	elevationInfo: {
		mode: "relative-to-scene",
	},
});

map.add(poiLayer);
map.add(busLayer);

view
	.whenLayerView(busLayer)
	.then((layerView) => {
		busLayerView = layerView;
	})
	.catch((err) => console.error(err));

view
	.whenLayerView(poiLayer)
	.then((layerView) => {
		initPOILayer(layerView);
	})
	.catch((err) => console.error(err));

view.on("click", (event) => {
	handleClickEvent(event);
});

// create a popup watcher for a spatial filter of bus stops
reactiveUtils.watch(
	() => view.popup.visible,
	(newVal, oldVal) => {
		if (typeof oldVal !== "boolean") {
			return;
		}

		if (newVal === false && busLayerView.filter !== null) {
			console.log("popup action disable");
			toggleSpatialFilter(busLayerView, false);
		}
	}
);

// controllers
function initPOILayer(layerView) {
	const categories = [];
	const uniqueValueInfos = poiLayer.renderer.toJSON().uniqueValueInfos.map((el) => {
		categories.push(el.value);
		const symbol = getUniqueValueSymbol(el.symbol);
		return {value: el.value, symbol};
	});
	poiRenderer.uniqueValueInfos = uniqueValueInfos;
	poiLayer.renderer = poiRenderer;

	const filterNode = document.createElement("div");
	filterNode.classList.add("filter-widget-container");
	const filterExpandWidget = createFilterWidget(categories, filterNode);
	view.ui.add(filterExpandWidget, "top-right");

	filterNode.addEventListener("click", filterByCategory);

	function filterByCategory(event) {
		const selectedCategory = event.target.getAttribute("category-data");

		layerView.filter = {
			where: `category_name = '${selectedCategory}'`,
		};

		if (view.popup.visible) {
			checkPopupCategory(selectedCategory, poiLayer).then((res) => togglePopup(res, busLayerView));
		}
	}

	filterExpandWidget.watch("expanded", () => {
		if (!filterExpandWidget.expanded) {
			layerView.filter = null;
		}
	});
}

function handleClickEvent(event) {
	view.hitTest(event, {include: poiLayer}).then((hitTestResult) => {
		if (hitTestResult.results.length) {
			toggleSpatialFilter(busLayerView, true, hitTestResult.results[0].graphic.geometry);
			return;
		}

		if (busLayerView.filter) {
			console.log("no feature on click disable");
			toggleSpatialFilter(busLayerView, false);
			return;
		}
	});
}

// services
function createFilterWidget(categories, node) {
	populateFilterWidget(categories, node);

	const widget = new Expand({
		content: node,
		view: view,
		expandIcon: "filter",
		id: "filter_widget",
	});

	return widget;
}

function populateFilterWidget(categories, node) {
	categories.forEach((name) => {
		const childNode = document.createElement("div");

		childNode.textContent = name;
		childNode.classList.add("category-item");
		childNode.setAttribute("category-data", name);

		node.appendChild(childNode);
	});
}

function checkPopupCategory(selectedCategory, layer) {
	const featureAttributes = view.popup.content.viewModel._graphicExpressionAttributes;
	const queryParams = {
		objectIds: [featureAttributes.OBJECTID],
		returnGeometry: false,
		outFields: ["category_name"],
	};

	return new Promise((resolve) => {
		try {
			layer.queryFeatures(queryParams).then((res) => {
				const featureCategory = res.features[0].attributes.category_name;
				if (featureCategory !== selectedCategory) {
					resolve(false);
				}
				resolve(true);
			});
		} catch (err) {
			console.error(err);
			resolve(false);
		}
	});
}

function togglePopup(category, layerView) {
	if (category) {
		return;
	}

	view.popup.close();
	console.log("filter category miss match disable");
	toggleSpatialFilter(layerView, false);
}

function toggleSpatialFilter(layerView, apply, point) {
	if (!layerView) {
		console.error("Bus layer view is disabled");
		return;
	}

	if (!apply) {
		layerView.filter = null;
		console.log("disabled spatial filter");
		return;
	}

	if (!point) {
		console.error("no point geometry provided");
		return;
	}

	console.log("apply filter");
	layerView.filter = {
		geometry: point,
		distance: 500,
		units: "meters",
		spatialRelationship: "intersects",
	};
}

function getUniqueValueSymbol(symbol) {
	const color = [...symbol.color];
	for (let key in symbol) {
		delete symbol[key];
	}

	symbol.type = "point-3d";
	symbol.symbolLayers = [
		{
			type: "icon",
			resource: {
				primitive: "circle",
			},
			size: 20,
			material: {color: "white"},
			outline: {
				color,
				size: 2,
			},
		},
	];
	symbol.verticalOffset = verticalOffset;
	symbol.callout = {
		type: "line",
		color: "white",
		size: 2,
		border: {
			color,
		},
	};

	return symbol;
}
