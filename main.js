import esriConfig from "https://js.arcgis.com/4.27/@arcgis/core/views/MapView.js";
import Map from "https://js.arcgis.com/4.27/@arcgis/core/Map.js";
import SceneView from "https://js.arcgis.com/4.27/@arcgis/core/views/SceneView.js";
import FeatureLayer from "https://js.arcgis.com/4.27/@arcgis/core/layers/FeatureLayer.js";
import SceneLayer from "https://js.arcgis.com/4.27/@arcgis/core/layers/SceneLayer.js";
import Expand from "https://js.arcgis.com/4.27/@arcgis/core/widgets/Expand.js";

// Initiallization
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

const buildingsLayer = new SceneLayer({
	url: "https://basemaps3d.arcgis.com/arcgis/rest/services/OpenStreetMap3D_Buildings_v1/SceneServer",
	popupEnabled: false,
	mouseEventsEnabled: false,
});
map.add(buildingsLayer);

// Definning Popups
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

const poiRenderer = {
	type: "unique-value",
	field: "category_name",
	defaultSymbol: {
		type: "point-3d",
		symbolLayers: [
			{
				type: "icon", // autocasts as new IconSymbol3DLayer()
				resource: {
					href: "https://developers.arcgis.com/javascript/latest/sample-code/visualization-point-styles/live/Museum.png",
				},
				size: 20,
				outline: {
					color: "white",
					size: 2,
				},
			},
		],

		verticalOffset: {
			screenLength: 40,
			maxWorldLength: 200,
			minWorldLength: 35,
		},

		callout: {
			type: "line", // autocasts as new LineCallout3D()
			color: "white",
			size: 2,
			border: {
				color: "#D13470",
			},
		},
	},
};

const poiLayer = new FeatureLayer({
	url: "https://services4.arcgis.com/XZEtqni2CM1tP1ZM/ArcGIS/rest/services/YerevanPOIs/FeatureServer/1",
	outFields: ["name", "category_name", "address_name", "telephone", "latitude", "longitude"],
	popupTemplate: poiPopup,
	// renderer: poiRenderer,
});
const busStopsLayer = new FeatureLayer({
	url: "https://services4.arcgis.com/XZEtqni2CM1tP1ZM/arcgis/rest/services/Bus_Service_WFL1/FeatureServer/1",
});

map.add(poiLayer);
map.add(busStopsLayer);

// set widget and renderer when layer is loaded
view.whenLayerView(poiLayer).then(
	(layerView) => {
		// Define categories and create a widget
		const categories = poiLayer.renderer.uniqueValueGroups[0].classes.map((val) => val.label);
		const filterNode = document.createElement("div");
		filterNode.classList.add("filter-widget-container");
		const filterExpand = setupFilterWidget(categories, filterNode);
		view.ui.add(filterExpand, "top-right");

		// create filter watcher
		filterNode.addEventListener("click", filterByCategory);
		function filterByCategory(event) {
			const selectedCategory = event.target.getAttribute("category-data");
			
			layerView.filter = {
				where: `category_name = '${selectedCategory}'`,
			};

			// close popup if other category
			if (view.popup.visible) {
				const featureName = view.popup.content.title;
				const query = {
					where: `name = '${featureName}'`,
					returnGeometry: false,
					outFields: ["category_name"],
				};
				poiLayer.queryFeatures(query).then((res) => {
					const popupCategory = res.features[0].attributes.category_name;
					if (popupCategory !== selectedCategory) {
						view.closePopup();
					}
				});
			}
		}
		filterExpand.watch("expanded", () => {
			if (!filterExpand.expanded) {
				layerView.filter = null;
			}
		});

		// setup a poi renderer style
		// const colors = poiLayer.renderer.
		poiLayer.renderer = poiRenderer;
	},
	(err) => console.log(err)
);

function setupFilterWidget(categories, node) {
	categories.forEach((name) => {
		const childNode = document.createElement("div");

		childNode.textContent = name;
		childNode.classList.add("category-item");
		childNode.setAttribute("category-data", name);

		node.appendChild(childNode);
	});

	const filterWidget = new Expand({
		content: node,
		view: view,
		expandIcon: "filter",
		id: "filter_widget",
	});

	return filterWidget;
}


