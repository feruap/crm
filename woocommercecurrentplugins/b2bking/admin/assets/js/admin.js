(function($){

	"use strict";

	$( document ).ready(function() {

		/**
		* General Functions
		*/

		// Initialize SemanticUI Menu Functions

		// radio buttons
		$('.ui.checkbox').checkbox();

		// accordions
		$('.ui.accordion').accordion();

		//Whitelabel Logo
		$('#b2bking-logo-upload-btn-whitelabel').on('click', function(e) {
	       e.preventDefault();

	       var image = wp.media({ 
	           title: 'Upload Image',
	           multiple: false
	       }).open()
	       .on('select', function(e){
	           // This will return the selected image from the Media Uploader, the result is an object
	           var uploaded_image = image.state().get('selection').first();
	           // Convert uploaded_image to a JSON object 
	           var b2bking_image_url = uploaded_image.toJSON().url;
	           // Assign the url value to the input field
	           $('#b2bking_whitelabel_logo_setting').val(b2bking_image_url).trigger('change');
	       });
	   	});

   		//Whitelabel Icon
   		$('#b2bking-logo-upload-btn-whitelabelicon').on('click', function(e) {
   	       e.preventDefault();

   	       var image = wp.media({ 
   	           title: 'Upload Image',
   	           multiple: false
   	       }).open()
   	       .on('select', function(e){
   	           // This will return the selected image from the Media Uploader, the result is an object
   	           var uploaded_image = image.state().get('selection').first();
   	           // Convert uploaded_image to a JSON object 
   	           var b2bking_image_url = uploaded_image.toJSON().url;
   	           // Assign the url value to the input field
   	           $('#b2bking_whitelabel_icon_setting').val(b2bking_image_url).trigger('change');
   	       });
   	   	});

		// Logo Upload
		$('#b2bking-logo-upload-btn').on('click', function(e) {
	       e.preventDefault();

	       var image = wp.media({ 
	           title: 'Upload Image',
	           multiple: false
	       }).open()
	       .on('select', function(e){
	           // This will return the selected image from the Media Uploader, the result is an object
	           var uploaded_image = image.state().get('selection').first();
	           // Convert uploaded_image to a JSON object 
	           var b2bking_image_url = uploaded_image.toJSON().url;
	           // Assign the url value to the input field
	           $('#b2bking_offers_logo_setting').val(b2bking_image_url).trigger('change');
	       });
	   	});
   		// Offers IMG Upload
   		$('#b2bking-logoimg-upload-btn').on('click', function(e) {
   	       e.preventDefault();

   	       var image = wp.media({ 
   	           title: 'Upload Image',
   	           multiple: false
   	       }).open()
   	       .on('select', function(e){
   	           // This will return the selected image from the Media Uploader, the result is an object
   	           var uploaded_image = image.state().get('selection').first();
   	           // Convert uploaded_image to a JSON object 
   	           var b2bking_image_url = uploaded_image.toJSON().url;
   	           // Assign the url value to the input field
   	           $('#b2bking_offers_image_setting').val(b2bking_image_url).trigger('change');
   	       });
   	   	});
		
		// Tab transition effect
		var previous = $('.ui.tab.segment.active');
	    $(".menu .item").tab({
	        onVisible: function (e) {
	            var current = $('.ui.tab.segment.active');
	            // hide the current and show the previous, so that we can animate them
	            previous.show();
	            current.hide();

	            // hide the previous tab - once this is done, we can show the new one
	            previous.find('.b2bking_attached_content_wrapper').css('opacity','0');
	            current.find('.b2bking_attached_content_wrapper').css('opacity','0');
	            setTimeout(function(){
	            	previous.hide();
	            	current.show();
	            	setTimeout(function(){
		            	current.find('.b2bking_attached_content_wrapper').css('opacity','1');
		            	// remember the current tab for next change
		            	previous = current;
		            },10);
	            },150);
	            
	        }
	    });
	    
		$('.ui.dropdown').dropdown();
		$('.b2bking_purchase_lists_language_setting').dropdown('set selected', b2bking.purchase_lists_language_option);
	
		$('.message .close').on('click', function() {
		    $(this).closest('.message').transition('fade');
		});

		// hide or show force login
		hideShowForceLogin();

		// On Product Visibility option change, update product visibility options 
		$('input[name=b2bking_guest_access_restriction_setting]').change(function() {
			hideShowForceLogin();
		});

		// Checks the selected Product Visibility option and hides or shows Automatic / Manual visibility options
		function hideShowForceLogin(){
			let selectedValue = $("input[name=b2bking_guest_access_restriction_setting]:checked").val();
			if(selectedValue === "hide_website") {
		      	$("#b2bking_access_restriction_force_redirect").css("display","block");
		   	} else {
				$("#b2bking_access_restriction_force_redirect").css("display","none");
			}
		}

		// On Submit (Save Settings), Get Current Tab and Pass The Tab as a Setting. 
		$('#b2bking_admin_form').on('submit', function() {
			let tabInput = document.querySelector('#b2bking_current_tab_setting_input');
		    tabInput.value = document.querySelector('.item.active').dataset.tab;
		    return true; 
		});

		// check if license activation
		const urlParams = new URLSearchParams(window.location.search);
		const myParam = urlParams.get('tab');
		if (myParam === 'activate'){
			$('.b2bking_license').click();
		}

		function showHideCreamSetting(){
			let setting = $('#b2bking_order_form_theme_setting_select').val();
			if (setting === 'cream'){
				$('#b2bking_order_form_creme_cart_button_setting_select').parent().parent().css('display','table-row');
				$('#b2bking_order_form_cream_multiselect_container').parent().parent().css('display','table-row');
			} else {
				$('#b2bking_order_form_creme_cart_button_setting_select').parent().parent().css('display','none');
				$('#b2bking_order_form_cream_multiselect_container').parent().parent().css('display','none');
			}

			if (setting === 'cream' || setting === 'indigo'){
				$('#b2bking_order_form_sortby_setting_select').parent().parent().css('display','table-row');
			} else {
				$('#b2bking_order_form_sortby_setting_select').parent().parent().css('display','none');
			}
		}

		showHideCreamSetting();
		$('#b2bking_order_form_theme_setting_select').on('change', showHideCreamSetting);


		function showHideVisibilitySettings(){
			let selectedValue = jQuery("input[name=b2bking_all_products_visible_all_users_setting]").is(':checked');
			if(selectedValue) {
		      	$("input[name=b2bking_hidden_has_priority_setting], input[name=b2bking_product_visibility_cache_setting]").parent().parent().parent().hide();
		      	$('.b2bking_visibility_instructions_message, .b2bking_advanced_visibility').hide();

		   	} else {
		   		$("input[name=b2bking_hidden_has_priority_setting], input[name=b2bking_product_visibility_cache_setting]").parent().parent().parent().show();
		   		$('.b2bking_visibility_instructions_message, .b2bking_advanced_visibility').show();
			}
		}
		showHideVisibilitySettings();
		$('input[name=b2bking_all_products_visible_all_users_setting]').on('change', showHideVisibilitySettings);



		// settings block
		jQuery('.b2bking_setting_block').on('click', function(){
			var val = $(this).attr('data-value');
			var setting = $(this).attr('data-setting');
			jQuery('#'+setting).val(val).trigger('change');

			if (val === 'enabled'){
				var check = true;
			} else {
				var check = false;
			}

			jQuery('input[name="'+setting+'"]').prop('checked', check).trigger('change');

			jQuery(this).addClass('active');
			$('.b2bking_setting_block').each(function(i){
				if ($(this).attr('data-setting') === setting){
					if ($(this).attr('data-value') !== val){
						$(this).removeClass('active');
					}
				}
			});
		});

		// if user switches from B2B to b2b/b2c hybrid, set guest access restricrtion to "none"
		$('input[name="b2bking_plugin_status_setting"]').change(function() {
	        // Check if the selected radio button has the value "hybrid"
	        if ($(this).val() === "hybrid") {
	            // Set the radio input with the name "b2bking_guest_access_restriction_setting" to "none"
	            $('input[name="b2bking_guest_access_restriction_setting"][value="none"]').prop('checked', true);
	        }
	    });

		// existing users apply wanring, move first
		jQuery('input[name="b2bking_registration_loggedin_setting"]').parent().parent().parent().after('<tr><td colspan="2" id="b2bking_existing_users_apply_warning_row"></td></tr>');
		jQuery('#b2bking_existing_users_apply_warning_row').append(jQuery('.b2bking_existing_users_apply_warning').detach());
		
		function showHideExistingWarning(){
			let selectedValue = jQuery("input[name=b2bking_registration_loggedin_setting]").is(':checked');
			if(selectedValue) {
		      	$('#b2bking_existing_users_apply_warning_row, .b2bking_existing_users_apply_warning').show();
		   	} else {
		      	$('#b2bking_existing_users_apply_warning_row, .b2bking_existing_users_apply_warning').hide();
			}
		}
		showHideExistingWarning();
		$('input[name=b2bking_registration_loggedin_setting]').on('change', showHideExistingWarning);


	});

})(jQuery);
