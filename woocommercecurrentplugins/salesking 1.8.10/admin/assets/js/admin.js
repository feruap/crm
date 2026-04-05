(function($){

	"use strict";

	$( document ).ready(function() {

		/**
		* General Functions
		*/

		// Initialize SemanticUI Menu Functions

		//Whitelabel Logo
		$('#salesking-logo-upload-btn-whitelabel').on('click', function(e) {
	       e.preventDefault();

	       var image = wp.media({ 
	           title: 'Upload Image',
	           multiple: false
	       }).open()
	       .on('select', function(e){
	           // This will return the selected image from the Media Uploader, the result is an object
	           var uploaded_image = image.state().get('selection').first();
	           // Convert uploaded_image to a JSON object 
	           var salesking_image_url = uploaded_image.toJSON().url;
	           // Assign the url value to the input field
	           $('#salesking_whitelabel_logo_setting').val(salesking_image_url).trigger('change');
	       });
	   	});

   		//Whitelabel Icon
   		$('#salesking-logo-upload-btn-whitelabelicon').on('click', function(e) {
   	       e.preventDefault();

   	       var image = wp.media({ 
   	           title: 'Upload Image',
   	           multiple: false
   	       }).open()
   	       .on('select', function(e){
   	           // This will return the selected image from the Media Uploader, the result is an object
   	           var uploaded_image = image.state().get('selection').first();
   	           // Convert uploaded_image to a JSON object 
   	           var salesking_image_url = uploaded_image.toJSON().url;
   	           // Assign the url value to the input field
   	           $('#salesking_whitelabel_icon_setting').val(salesking_image_url).trigger('change');
   	       });
   	   	});

		// radio buttons
		$('.ui.checkbox').checkbox();
		
		// Tab transition effect
		var previous = $('.ui.tab.segment.active');
	    $(".menu .item").tab({
	        onVisible: function (e) {
	            var current = $('.ui.tab.segment.active');
	            // hide the current and show the previous, so that we can animate them
	            previous.show();
	            current.hide();

	            // hide the previous tab - once this is done, we can show the new one
	            previous.find('.salesking_attached_content_wrapper').css('opacity','0');
	            current.find('.salesking_attached_content_wrapper').css('opacity','0');
	            setTimeout(function(){
	            	previous.hide();
	            	current.show();
	            	setTimeout(function(){
		            	current.find('.salesking_attached_content_wrapper').css('opacity','1');
		            	// remember the current tab for next change
		            	previous = current;
		            },10);
	            },150);
	            
	        }
	    });
	    
		$('.ui.dropdown').dropdown();
	
		$('.message .close').on('click', function() {
		    $(this).closest('.message').transition('fade');
		});

		// On Submit (Save Settings), Get Current Tab and Pass The Tab as a Setting. 
		$('#salesking_admin_form').on('submit', function() {
			let tabInput = document.querySelector('#salesking_current_tab_setting_input');
		    tabInput.value = document.querySelector('.item.active').dataset.tab;
		    return true; 
		});

		$('.salesking_tables_language_option_setting').dropdown('set selected', salesking.tables_language_option);


		// Logo Upload
		$('#salesking-upload-btn').on('click', function(e) {
	       e.preventDefault();

	       var image = wp.media({ 
	           title: 'Upload Image',
	           multiple: false
	       }).open()
	       .on('select', function(e){
	           // This will return the selected image from the Media Uploader, the result is an object
	           var uploaded_image = image.state().get('selection').first();
	           // Convert uploaded_image to a JSON object 
	           var salesking_image_url = uploaded_image.toJSON().url;
	           // Assign the url value to the input field
	           $('#salesking_logo_setting').val(salesking_image_url);
	           $('.salesking_email_preview_logo').attr('src', salesking_image_url);
	       });
	   	});

		// Favicon Upload
		$('#salesking-upload-btn-favicon').on('click', function(e) {
	       e.preventDefault();

	       var image = wp.media({ 
	           title: 'Upload Image',
	           multiple: false
	       }).open()
	       .on('select', function(e){
	           // This will return the selected image from the Media Uploader, the result is an object
	           var uploaded_image = image.state().get('selection').first();
	           // Convert uploaded_image to a JSON object 
	           var marketking_image_url = uploaded_image.toJSON().url;
	           // Assign the url value to the input field
	           $('#salesking_logo_favicon_setting').val(marketking_image_url);
	           $('.marketking_email_preview_logo').attr('src', marketking_image_url);
	       });
	   	});

	   	// Salesking agent ID and agent dropdown settings are mutually exclusive
	   	$('input[name="salesking_enable_agent_id_registration_dropdown_setting"]').on('change', function(){
	   		let checked = $(this).is(':checked');
	   		if (checked == true){
	   			// deactivate other setting
	   			$('input[name="salesking_enable_agent_id_registration_setting"]').prop( "checked", false );
	   		}
	   	});
	   	$('input[name="salesking_enable_agent_id_registration_setting"]').on('change', function(){
	   		let checked = $(this).is(':checked');
	   		if (checked == true){
	   			// deactivate other setting
	   			$('input[name="salesking_enable_agent_id_registration_dropdown_setting"]').prop( "checked", false );
	   		}
	   	});

	   	// check if license activation
	   	const urlParams = new URLSearchParams(window.location.search);
	   	const myParam = urlParams.get('tab');
	   	if (myParam === 'activate'){
	   		$('.salesking_license').click();
	   	}

	});

})(jQuery);
