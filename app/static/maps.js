function createMap() {
	console.log("createMap");
	app.geocoder = new google.maps.Geocoder();
	var mapOptions = {
		center: new google.maps.LatLng(-34.397, 150.644),
		zoom: 2,
		mapTypeId: google.maps.MapTypeId.TERRAIN //ROADMAP
	};
	app.map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
}

function searchForAddress() {
	var address = document.getElementById("searchAddress").value;
	if(app.currentSearchMarker) app.currentSearchMarker.setMap(null); //remove current search marker from map
	app.geocoder.geocode( { 'address': address}, function(results, status) {
		if (status == google.maps.GeocoderStatus.OK) {
			app.map.setCenter(results[0].geometry.location);
			app.currentSearchMarker = new google.maps.Marker({
				map: app.map,
				position: results[0].geometry.location
			});
			app.map.setZoom(17);
		} else {
			//console.log("Geocode was not successful for the following reason: " + status);
			alert("No matching address found");
			app.map.setZoom(2);
			app.currentSearchMarker = null;
		}
	});
}

function addMapMarker(lat, lng) {
	var myLatlng = new google.maps.LatLng(lat,lng);
	app.map.setCenter(myLatlng);
	var marker = new google.maps.Marker({
		map: app.map,
		position: myLatlng
	});
	return marker;
}