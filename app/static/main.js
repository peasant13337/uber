var app = {"map":null, "geocoder":null, "currentSearchMarker":null, "editingId":null};

$(document).ready(function() {

	///////////////
	//	Variables
	///////////////
	var addressList,	//Backbone Collection of saved locations
		mapView,		//Backbone View of Google Map
		searchForm,		//Backbone View of Search Form
		localBackbone = Backbone.noConflict();	//Prevent conflict of other Backone Versions on page

	///////////
	//	Model
	///////////
	app.Address = localBackbone.Model.extend({	//Backbone Model that stores saved location data
		defaults: {
			id: null,	//Unique Id created by our sqlite database
			lat: null,	//Latitude of address
			lng: null,	//Longitude of address
			address: "",	//Address String that the user searched for
			nickname: ""	//Nickname of address that user chose
		},
		marker: null	//Google Map Marker object for the address
	});

	////////////////
	//	Collection
	////////////////
	app.AddressList = localBackbone.Collection.extend({	//Backbone Collection of saved locations
		model: app.Address,	//The model that this collection will contain
		initialize: function() {	//Called when we instantiate the Collection
			this.fetchAddresses();	//Fetch any saved locations from the database and add them to this collection
		},
		fetchAddresses: function() {	//Ajax method to fetch saved locations from database and add them to this collection
			var collection = this;	//Reference variable to "this" collection, $.post "this" will conflict otherwise
			$.post("/selectdb/", {}).done(function(data) {	
				data = jQuery.parseJSON(data)	//convert the returned JSON String into a JSON Object
				collection.add(data.addresses);	//json returns an array of locations, this call automatically instantiates a model for each
				$.each(collection.models,function(index, val){	//loop over "this" collection of locations
					var view = new app.AddressView({model: val});	//for each address create a new Backbone AddressView
				});
			});
		}
	});

	/////////////
	//	Views
	/////////////
	app.MapView = localBackbone.View.extend({	//Backbone View for the Google Map
		el:"#map-canvas",	//The div that contains the Google Map
		initialize: function() {	//Called when we instantiate the View
			google.maps.event.addDomListener(window, "load", this.render());	//When Google Maps JS is ready, render this view
		},
		render: function() {
			createMap();	//Create the Google Map
		},
		renderMapMarker: function(id) {	//Function to render a specific model's marker to the Google Map
			var model = addressList.findWhere({"id": String(id)});	//Find the model based on the Id parameter
			try { model.marker.setMap(null) } catch(e) {}			//Delete the marker in case the model's address changed
			model.marker = addMapMarker(model.get("lat"), model.get("lng"))	//Create the marker on the Google Map
		}
	});

	app.AddressView = localBackbone.View.extend({	//Backbone View of saved locations
		events: {
			"click": "addressClick"	//Click event when this view is clicked
		},
		initialize: function() {	//Called when we instantiate the View
			this.render();
			this.model.on("change",this.render,this);	//Called when View changes
			this.model.on("destroy",this.destroy,this);	//Called and triggered when we destroy View
		},
		destroy: function() {
			$("#addresses #model-"+this.model.get("id")).remove(); //Remove this View from the DOM
			this.stopEdit();	//Stop any editing and reset the SearchForm
		},
		render: function() {
			var template = $("script#addressTemplate").html();	//Get the underscore template for the locations View
			var addressElement = $(_.template(template, this.model.attributes));	//Render this View's content into the underscore template
			$("#addresses").append( addressElement ) //Append the rendered template to the DOM
			this.setElement(addressElement);	//Set the Backbone root element of this view to the newly rendered template
			mapView.renderMapMarker(this.model.get("id"));	//Create a new map marker for this view's model
			this.stopEdit();	//Address added successfully so reset SearchForm, MapView
		},
		addressClick: function(event, params) {	//Click event when this view is clicked
			this.stopEdit();	//Stop any editing and reset the SearchForm

			this.$el.removeClass("gradientGreen").addClass("gradientOrange");	//Add orange gradient to this view since it is now active

			app.editingId = this.model.get("id");	//Set the editable id to this view's model's id
			app.map.setCenter(this.model.marker.position);	//Center map on marker
			app.map.setZoom(12);	//Zoom map on marker

			searchForm.$el.find("#searchAddress").val(this.model.get("address"));	//Fill SearchForm Address input with model's address
			searchForm.$el.find("#nickname").val(this.model.get("nickname"));	//Fill SearchForm Nickname input with model's nickname

			if(params)	//When Edit Mode for an Address is enabled/disabled, we pass an "edit" flag with event set to true/false
				params["edit"] ? this.startEdit() : this.stopEdit(); //Enable or disable editing depending on "edit" flag
		},
		startEdit: function() {	//Called when user wants to edit a location
			this.$el.removeClass("gradientGreen").addClass("gradientOrange");	//Add orange gradient to this view since it is now active
			app.editingId = this.model.get("id"); 	//Set id of model being edited
			searchForm.$el.find(".title").text("Editing"); 	//Change SearchForm title to "Editing"
			searchForm.$el.find("#deleteAddress, #stopEdit, #updateAddress").show();	//Show relevant "edit" buttons
			searchForm.$el.find("#startEdit, #saveAddress").hide();	//Hide relevant "non-edit buttons"
			
			app.map.setZoom(17);	//Zoom map on marker
			searchForm.$el.find("#searchAddress").val(this.model.get("address"));	//Fill SearchForm Address input with model's address
			searchForm.$el.find("#nickname").val(this.model.get("nickname"));	//Fill SearchForm Nickname input with model's address
			app.currentSearchMarker = null;	//Null the active map marker, this forces user to validate new address
		},
		stopEdit: function() {
			$(".address").addClass("gradientGreen").removeClass("gradientOrange");
			app.editingId = null;	//Set id of model being edited
			searchForm.$el.find(".title").text("Search");	//Change SearchForm title to "Search"
			searchForm.$el.find("#deleteAddress, #stopEdit, #updateAddress").hide();	//Hide relevant "edit" buttons
			searchForm.$el.find("#startEdit, #saveAddress").show();	//Show relevant "non-edit buttons"

			app.map.setZoom(2);	//Zoom map on marker
			searchForm.$el.find("#searchAddress").val("");	//Empty SearchForm Address input
			searchForm.$el.find("#nickname").val("");	//Empty Nickname Address input
			app.currentSearchMarker = null;	//Null the active map marker, this forces user to validate new address
		}
	});

	app.searchFormView = localBackbone.View.extend({	//Backbone View of the Search Form
		el: "#searchForm",	//The div that contains the search form
		events: {	//Search Form events
			"keyup input#searchAddress": "keyUp",
			"click #searchBtn": "search",
			"click #saveAddress": "saveAddress",
			"click #updateAddress": "updateAddress",
			"click #deleteAddress": "deleteAddress",
			"click #startEdit": "startEdit",
			"click #stopEdit": "stopEdit"
		},
		keyUp: function(event) {	//Fired when user presses Enter Key on Address Input
			var code = (event.keyCode ? event.keyCode : event.which);	//Get the event keycode
			if(code == 13)	//Enter Pressed
				searchForAddress();	//Search for the address through Google Map API
		},
		startEdit: function(event) {
			if(app.editingId)	//if a model is active in the search form
				$("#model-"+app.editingId).trigger("click",{"edit":true});	//then trigger the AddressView addressClick method
			else
				alert("Select a saved location first");	//else no model is active so inform user
		},
		stopEdit: function(event) {
			$("#model-"+app.editingId).trigger("click",{"edit":false});	//trigger the AddressView addressClick method with "edit" flag "false to stop edit mode"
		},
		search: function(event) {
			searchForAddress();	//Search for the address through Google Map API
		},
		deleteAddress: function(event) {
			$.post("/deletedb/", { "id":app.editingId }).done(function(data) {	//Ajax method to the Flask "/deletedb" route to delete the model
				data = jQuery.parseJSON(data);	//Convert returned JSON string to JSON Object
				if(data["result"] == "success") {	//If delete was successful
					var model = addressList.findWhere({"id": String(app.editingId)});	//Get the model that was deleted from database
					model.trigger("destroy");	//Trigger the model's destroy event
					addressList.remove(model);	//Remove the deleted model from the list
				}
			});
		},
		updateAddress: function(event) {
			if(app.currentSearchMarker) {	//If a model is active in the SearchForm and the Google Map
				var lat = app.currentSearchMarker.position.lat(),	//Get the active marker latitude
					lng = app.currentSearchMarker.position.lng(),	//Get the active marker longitude
					address = this.$el.find("#searchAddress").val(),	//Get the current SearchForm address
					nickname = this.$el.find("#nickname").val()	//Get the current SearchForm nickname

				$.post("/updatedb/", { "id":app.editingId, "lat":lat, "lng":lng, "address":address, "nickname":nickname }).done(function(data) {	//Ajax mehtod to the flask /updatedb" route to update the model
					data = jQuery.parseJSON(data);	//Convert returned JSON string to JSON Object
					if(data["result"] == "success") {	//If update was successful
						var model = addressList.findWhere({"id": String(app.editingId)});	//get the model to be updated
						$("#model-"+app.editingId).remove();	//remove the old model from the View
						model.marker = app.currentSearchMarker;	//Set the model's new search marker
						mapView.renderMapMarker(app.editingId);	//Render the new marker on the Google Map
						model.set({
							"address": address,
							"nickname": nickname,
							"lat": lat,
							"lng": lng
						});	//Set the model's new attributes
						searchForm.stopEdit();	//Reset the SearchForm
					}
				});

			} else {
				alert("Search for a new address first");	//Inform user if address needs to be searched/validated
			}
		},
		saveAddress: function(event) {
			if(app.currentSearchMarker) {	//If a model is active in the SearchForm and the Google Map
				var lat = app.currentSearchMarker.position.lat(),	//Get the active marker latitude
					lng = app.currentSearchMarker.position.lng(),	//Get the active marker latitude
					address = this.$el.find("#searchAddress").val(),	//Get the current SearchForm address
					nickname = this.$el.find("#nickname").val()	//Get the current SearchForm nickname

				$.post("/insertdb/", { "lat":lat, "lng":lng, "address":address, "nickname":nickname }).done(function(data) {	//Ajax mehtod to the flask /insertdb" route to save the new model
					data = jQuery.parseJSON(data);	//Convert returned JSON string to JSON Object
					if(data["id"] == -1)	//If database insert was not successful then return immediately
						return;
					
					var model = new app.Address({
						"id": data["id"],
						"lat": lat,
						"lng": lng,
						"address": address,
						"nickname": nickname
					});	//Create a new backbone model for the inserted location
					app.currentSearchMarker.setMap(null);	//Remove searched map marker
					addressList.add(model);	//Add new model to addressList
					var view = new app.AddressView({model: model}); //Add new AddressView to DOM
					app.currentSearchMarker = null;	//Null the searched marker

				});
			} else {
				alert("Search for an address first");	//Inform user to search and get address validated before trying to save location
			}
		},
	});

	mapView = new app.MapView();	//Instantiate the Backbone Map View 
	searchForm = new app.searchFormView();	//Instantiate the Backbone SearchForm View
	addressList = new app.AddressList(); //Instantiate the Backbone AddressList Collection, the initiialize method fetches the saved locations

});




















