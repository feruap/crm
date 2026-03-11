/**
*
* JavaScript file that has global action in the admin menu
*
*/
(function($){

	"use strict";

	$( document ).ready(function() {

		// Move header to top of page
		jQuery('#wpbody-content').prepend(jQuery('#salesking_admin_header_bar').detach());

		var buttonclass = 'salesking-btn-gray';

		// Show Hide Color Scheme Settings
		colorschemeshowhide();

		$('input[name=salesking_change_color_scheme_setting]').change(function() {
			colorschemeshowhide();
		});

		function colorschemeshowhide(){
			let selectedValue = $('input[name=salesking_change_color_scheme_setting]').is(":checked");
			if(selectedValue === true) {
		      	$(".salesking_change_color_scheme_container").css("display","block");
		   	} else {
				$(".salesking_change_color_scheme_container").css("display","none");
			}
		}

		// Group movements
		$("body.post-type-salesking_group .wrap a.page-title-action").after('&nbsp;<a href="'+salesking.group_rules_link+'" class="page-title-action">'+salesking.group_rules_text+'</a>');

		/* Tools */

		
		// on click mark as read
	    $('#salesking_markasreadadmin').on('click', function(){
			var datavar = {
	            action: 'saleskingmarkreadmessagead',
	            security: salesking.security,
	            messageid: $(this).val(),
	        };

			$.post(ajaxurl, datavar, function(response){
				window.location.reload();
			});
	    	
	    });

	    // On clicking set accounts as subaccounts
	    $('#salesking_set_accounts_as_subaccounts').on('click', function(){
	    	if (confirm(salesking.are_you_sure_set_subaccounts)){
				var datavar = {
		            action: 'saleskingbulksetsubaccounts',
		            security: salesking.security,
		            option_first: $('#salesking_set_user_subaccounts_first').val(),
		            option_second: $('#salesking_set_user_subaccounts_second').val(),
		        };

				$.post(ajaxurl, datavar, function(response){
					alert(salesking.subaccounts_have_been_set);
					window.location.reload();
				});
	    	}
	    });

        // On clicking set accounts as regular accounts
        $('#salesking_set_subaccounts_regular_button').on('click', function(){
        	if (confirm(salesking.are_you_sure_set_subaccounts_regular)){
    			var datavar = {
    	            action: 'saleskingbulksetsubaccountsregular',
    	            security: salesking.security,
    	            option_first: $('#salesking_set_subaccounts_regular_input').val(),
    	        };

    			$.post(ajaxurl, datavar, function(response){
    				alert(salesking.subaccounts_have_been_set);
    				window.location.reload();
    			});
        	}
        });

         // On clicking set agent for all custoemrs
        $('#salesking_setagent_button').on('click', function(){
        	if (confirm(salesking.are_you_sure_set_agent_customers)){
    			var datavar = {
    	            action: 'salesking_setagentall',
    	            security: salesking.security,
    	            option_first: $('#salesking_setagent').val(),
    	        };

    			$.post(ajaxurl, datavar, function(response){
    				alert(salesking.subaccounts_have_been_set);
    				window.location.reload();
    			});
        	}
        });


		// activate plugin
		$('#salesking-activate-license').on('click', function(){
			var datavar = {
	            action: 'saleskingactivatelicense',
	            email: $('input[name="salesking_license_email_setting"]').val().trim(),
	            key: $('input[name="salesking_license_key_setting"]').val().trim(),
	            security: salesking.security,
	        };
	        
	        $('#salesking-activate-license').notify(salesking.sending_request,{  position: "right",  className: 'info'});

			$.post(ajaxurl, datavar, function(response){
				if (response === 'success'){
					$('#salesking-admin-submit').click();
				} else {
					$('#salesking-activate-license').notify(response,{  position: "right",  className: 'error'});
				}
			});
		});

		// deactivate
		$('#salesking_deactivate_license').on('click', function(){
			if (confirm(salesking.sure_deactivate_license)){
				var datavar = {
		            action: 'saleskingdeactivatelicense',
		            security: salesking.security,
		        };
		        
		        $('#salesking_deactivate_license').notify(salesking.deactivating,{  position: "right",  className: 'info'});

				$.post(ajaxurl, datavar, function(response){
					window.location.reload();
				});
			}
		});

		/* Orders */
		// On Order commissions click
		$('.salesking_main_edit_icon').on('click', function(){
			var commissions_value = $('#salesking_main_commission_order_value').val();
			$('.salesking_main_commission_order').html('<input type="number" name="salesking_main_commission_order_value_edited" step="0.01" value="'+commissions_value+'"></input>');
			$(this).remove();
		});

		$('.salesking_edit_icon').on('click', function(){
			var agent_id = $(this).parent().find('.salesking_edit_icon_agent').val();
			var commissions_value = $(this).parent().parent().parent().find('.salesking_commission_order_value_'+agent_id).val();

			$(this).parent().parent().parent().find('.salesking_commission_order_'+agent_id).html('<input type="number" name="salesking_commission_order_value_edited_'+agent_id+'" step="0.01" value="'+commissions_value+'"></input>');
			$(this).remove();
		});

		/* Payouts */
		if (typeof $('#salesking_admin_payouts_table').DataTable === "function") { 
			$('#salesking_admin_payouts_table').DataTable({
				"language": {
				    "url": salesking.datatables_folder+salesking.tables_language_option+'.json'
				},
				oLanguage: {
	                sSearch: ""
	            },
	            dom: 'Bfrtip',
	            columnDefs: [
	                { targets: 0, visible: false}
	              ],
	            buttons: {
	                buttons: [
	                    { extend: 'csvHtml5', className: buttonclass, text: '↓ CSV', exportOptions: { columns: ":visible" } },
	                    { extend: 'pdfHtml5', className: buttonclass, text: '↓ PDF', exportOptions: { columns: ":visible" } },
	                    { extend: 'print', className: buttonclass, text: salesking.print, exportOptions: { columns: ":visible" } },
	                    { extend: 'colvis', className: buttonclass, text: salesking.edit_columns },
	                ]
	            }
			});
		}


		if (typeof $('#salesking_payout_history_table').DataTable === "function") { 

			var count = jQuery("#salesking_payout_history_table thead tr th").length;
			if (count >= 7){
				var targ = [6,7];
			} else {
				var targ = []; 
			}

			var table = $('#salesking_payout_history_table').DataTable({
				"language": {
				    "url": salesking.datatables_folder+salesking.tables_language_option+'.json'
				},
				oLanguage: {
	                sSearch: ""
	            },
	            dom: salesking.payouthistorydom,
	            columnDefs: [
	                { targets: targ, visible: false}
	              ],
	            order: [[1, 'desc']],
	            buttons: {
	                buttons: [
	                    { extend: 'csvHtml5', className: buttonclass, text: '↓ CSV', exportOptions: { columns: ":visible" } },
	                    { extend: 'pdfHtml5', className: buttonclass, text: '↓ PDF', exportOptions: { columns: ":visible" } },
	                    { extend: 'print', className: buttonclass, text: salesking.print, exportOptions: { columns: ":visible" } },
	                    { extend: 'colvis', className: buttonclass, text: salesking.edit_columns },
	                ]
	            }
			});

			setTimeout(function(){
				$('#salesking_payout_history_table tfoot tr:eq(0) th').each( function (i) {
				    var title = $(this).text();
				    $(this).html( '<input type="text" class="salesking_search_table" placeholder="'+salesking.searchtext+'..." />' );
				
				    $( 'input', this ).on( 'keyup change', function () {
				        if ( table.column(i).search() !== this.value ) {
				            table
				                .column(i)
				                .search( this.value )
				                .draw();
				        }
				    } );
				} );
			}, 250);
			
		}
	   


		if (typeof $('#salesking_payout_history_table2').DataTable === "function") { 
			$('#salesking_payout_history_table2').DataTable({
				"language": {
				    "url": salesking.datatables_folder+salesking.tables_language_option+'.json'
				},
				oLanguage: {
	                sSearch: ""
	            },
	            dom: salesking.payouthistorydom,
	            order: [[1, 'desc']],
	            buttons: {
	                buttons: [
	                    { extend: 'csvHtml5', className: buttonclass, text: '↓ CSV', exportOptions: { columns: ":visible" } },
	                    { extend: 'pdfHtml5', className: buttonclass, text: '↓ PDF', exportOptions: { columns: ":visible" } },
	                    { extend: 'print', className: buttonclass, text: salesking.print, exportOptions: { columns: ":visible" } },
	                    { extend: 'colvis', className: buttonclass, text: salesking.edit_columns },
	                ]
	            }
			});
		}


		/* Earnings */
		if (typeof $('#salesking_admin_earnings_table').DataTable === "function") { 
			$('#salesking_admin_earnings_table').DataTable({
				"language": {
				    "url": salesking.datatables_folder+salesking.tables_language_option+'.json'
				},
				oLanguage: {
	                sSearch: ""
	            },
	            dom: 'Bfrtip',
	            columnDefs: [
	                { targets: 0, visible: false}
	              ],
	            buttons: {
	                buttons: [
	                    { extend: 'csvHtml5', className: buttonclass, text: '↓ CSV', exportOptions: { columns: ":visible" } },
	                    { extend: 'pdfHtml5', className: buttonclass, text: '↓ PDF', exportOptions: { columns: ":visible" } },
	                    { extend: 'print', className: buttonclass, text: salesking.print, exportOptions: { columns: ":visible" } },
	                    { extend: 'colvis', className: buttonclass, text: salesking.edit_columns },
	                ]
	            }
			});
		}
		


		// On clicking "Save Payment"
	    $('#salesking_save_payment').on('click', function(){
	    	var amount = $('#salesking_reimbursement_value').val();
	    	var method = $('#salesking_reimbursement_method').val();
	    	var note = $('#salesking_reimbursement_note').val();
	    	var uid = $('input[name=salesking_admin_user_id]').val();

	    	if (method !== '' && amount !== ''){
		    	if (confirm(salesking.sure_save_payment)){
					var datavar = {
			            action: 'saleskingsavepayment',
			            security: salesking.security,
			            pamount: amount,
			            pmethod: method,
			            pnote: note,
			            userid: uid,
			            bonus: $('#salesking_bonus_payment').is(":checked"),
			        };

					$.post(ajaxurl, datavar, function(response){
						window.location.reload();
					});
		    	}
	    	} else {
	    		alert(salesking.please_set_amount_method);
	    	}

	    	
	    });

	    // Teams table

		/* Customers */
		//initialize admin customers table if function exists (we are in the Customers panel)
		if (typeof $('#salesking_admin_customers_table').DataTable === "function") { 
			$('#salesking_admin_customers_table').DataTable({
	            "language": {
				    "url": salesking.datatables_folder+salesking.tables_language_option+'.json'
				},
	        });
		}

	    // On clicking the "Add user button in the Product Category User Visibility table"
	    $("#salesking_category_add_user").on("click",function(){
	    	// Get username
	    	let username = $("#salesking_all_users_dropdown").children("option:selected").text();
	    	// Get content and check if username already exists
	    	let content = $("#salesking_category_users_textarea").val();
	    	let usersarray = content.split(',');
	    	let exists = 0;

	    	$.each( usersarray, function( i, val ) {
	    		if (val.trim() === username){
	    			exists = 1;
	    		}
	    	});

	    	if (exists === 1){
	    		// Show "Username already in the list" for 3 seconds
	    		$("#salesking_category_add_user").text(b2bking.username_already_list);
	    		setTimeout(function(){
	    			$("#salesking_category_add_user").text(b2bking.add_user);
	    		}, 2000);

	    	} else {
	    		// remove last comma and whitespace after
	    		content = content.replace(/,\s*$/, "");
	    		// if list is not empty, add comma
	    		if (content.length > 0){
	    			content = content + ', ';
	    		}
	    		// add username
	    		content = content + username;
	    		$("#salesking_category_users_textarea").val(content);
	    	}
	    });
		

		// Show Hide Custom Method Payment Settings
		custommethodshowhide();

		$('input[name=salesking_different_commission_price_increase_setting]').change(function() {
			custommethodshowhide();
		});

		function custommethodshowhide(){
			let selectedValue = $('input[name=salesking_different_commission_price_increase_setting]').is(":checked");
			if(selectedValue === true) {
		      	$("#salesking_custom_commission_container").css("display","block");
		   	} else {
				$("#salesking_custom_commission_container").css("display","none");
			}
		}

		// Show Hide Commission
		commissionshowhide();

		$('input[name=salesking_enable_custom_payouts_setting]').change(function() {
			commissionshowhide();
		});

		function commissionshowhide(){
			let selectedValue = $('input[name=salesking_enable_custom_payouts_setting]').is(":checked");
			if(selectedValue === true) {
		      	$("#salesking_custom_method_container").css("display","block");
		   	} else {
				$("#salesking_custom_method_container").css("display","none");
			}
		}

		// Customer or Agent group show hide
		agentcustomershowhide();
		$('input[type=radio][name="salesking_user_choice"]').change(function () {   
		    agentcustomershowhide();
		});
		function agentcustomershowhide(){
			let selectedValue = $('input[type=radio][name="salesking_user_choice"]:checked').val();
			if(selectedValue === "customer") {
		      	$(".salesking_agent_settings_agent").css("display","none");
		      	$(".salesking_agent_settings_customer").css("display","flex");
		   	} else if (selectedValue === "agent"){
				$(".salesking_agent_settings_agent").css("display","flex");
				$(".salesking_agent_settings_customer").css("display","none");
			}
		}

		// User profile sales agent group show/hide
		salesagentshowhide();

		$('#salesking_group').change(function() {
			salesagentshowhide();
		});

		function salesagentshowhide(){
			let selectedValue = $("#salesking_group").children("option:selected").val();
			if(selectedValue === "none") {
		      	$(".salesking_discount_percentage_column").css("display","none");
		   	} else {
				$(".salesking_discount_percentage_column").css("display","block");
			}
		}

		// In admin emails, modify email path for theme folder.
		if (($('#woocommerce_salesking_new_announcement_email_enabled').val() !== undefined)){
			var text = $('.template_html').html();
			var newtext = text.replace("/woocommerce/", "/");
			$('.template_html').html(newtext);
			$('.template_html p a:nth-child(2)').remove();
		}

				
		/* Conversations */
		// On load conversation, scroll to conversation end
		// if conversation exists
		if ($('#salesking_conversation_messages_container').length){
			$("#salesking_conversation_messages_container").scrollTop($("#salesking_conversation_messages_container")[0].scrollHeight);
		}

	
		/* Dynamic Rules */
		// On page load, before everything, set up conditions from hidden field to selectors
		setUpConditionsFromHidden();
		// update dynamic pricing rules
		updateDynamicRulesOptionsConditions();

		// Initialize Select2s
		$('#salesking_rule_select_who').select2();
		//$('#salesking_rule_select_agents_who').select2();

		$('#salesking_rule_select_applies').select2();
		

		// initialize multiple products / categories selector as Select2
		$('.salesking_select_multiple_product_categories_selector_select, .salesking_select_multiple_users_selector_select').select2({'width':'100%', 'theme':'classic'});
		// show hide multiple products categories selector
		showHideMultipleProductsCategoriesSelector();
		$('#salesking_rule_select_what').change(showHideMultipleProductsCategoriesSelector);
		$('#salesking_rule_select_applies').change(showHideMultipleProductsCategoriesSelector);
		function showHideMultipleProductsCategoriesSelector(){
			let selectedValue = $('#salesking_rule_select_applies').val();
			let selectedWhat = $('#salesking_rule_select_what').val();
			if ( (selectedValue === 'multiple_options' && selectedWhat !== 'tax_exemption_user') || (selectedValue === 'excluding_multiple_options' && selectedWhat !== 'tax_exemption_user')){
				$('#salesking_select_multiple_product_categories_selector').css('display','block');
			} else {
				$('#salesking_select_multiple_product_categories_selector').css('display','none');
			}

			if (selectedValue === 'earnings_monthly' || selectedValue === 'order_value_monthly'){
				// hide multiple options
				$('option[value="multiple_options"]').parent().css('display','none');
				$('#salesking_select_multiple_agents_selector, option[value="multiple_options"]').css('display','none');

			} else {
				$('option[value="multiple_options"]').parent().css('display','block');
				$('option[value="multiple_options"]').css('display','block');

			}
		}

		showHideMultipleUsersSelector();
		$('#salesking_rule_select_who').change(showHideMultipleUsersSelector);
		function showHideMultipleUsersSelector(){
			let selectedValue = $('#salesking_rule_select_who').val();
			if (selectedValue === 'multiple_options'){
				$('#salesking_select_multiple_users_selector').css('display','block');
			} else {
				$('#salesking_select_multiple_users_selector').css('display','none');
			}
		}

		showHideMultipleAgentsSelector();
		$('#salesking_rule_select_agents_who').change(showHideMultipleAgentsSelector);
		function showHideMultipleAgentsSelector(){
			let selectedValue = $('#salesking_rule_select_agents_who').val();
			if (selectedValue === 'multiple_options'){
				$('#salesking_select_multiple_agents_selector').css('display','block');
			} else {
				$('#salesking_select_multiple_agents_selector').css('display','none');
			}
		}

		function setUpConditionsFromHidden(){
			// get all conditions
			let conditions = $('#salesking_rule_select_conditions').val();
			if (conditions === undefined) {
				conditions = '';
			}

			if(conditions.trim() !== ''){  
				let conditionsArray = conditions.split('|');
				let i=1;
				// foreach condition, create selectors
				conditionsArray.forEach(function(item){
					let conditionDetails = item.split(';');
					// if condition not empty
					if (conditionDetails[0] !== ''){
						$('.salesking_dynamic_rule_condition_name.salesking_condition_identifier_'+i).val(conditionDetails[0]);
						$('.salesking_dynamic_rule_condition_operator.salesking_condition_identifier_'+i).val(conditionDetails[1]);
						$('.salesking_dynamic_rule_condition_number.salesking_condition_identifier_'+i).val(conditionDetails[2]);
						addNewCondition(i, 'programatically');
						i++;
					}
				});
			}
		}

		// On clicking "add condition" in Dynamic rule
		$('body').on('click', '.salesking_dynamic_rule_condition_add_button', function(event) {
		    addNewCondition(1,'user');
		});

		function addNewCondition(buttonNumber = 1, type = 'user'){
			let currentNumber;
			let nextNumber;

			// If condition was added by user
			if (type === 'user'){
				// get its current number
				let classList = $('.salesking_dynamic_rule_condition_add_button').attr('class').split(/\s+/);
				$.each(classList, function(index, item) {
				    if (item.includes('identifier')) {
				    	var itemArray = item.split("_");
				    	currentNumber = parseInt(itemArray[3]);
				    }
				});
				// set next number
				nextNumber = (currentNumber+1);
			} else {
				// If condition was added at page load automatically
				currentNumber = buttonNumber;
				nextNumber = currentNumber+1;
			}

			// add delete button same condition
			$('.salesking_dynamic_rule_condition_add_button.salesking_condition_identifier_'+currentNumber).after('<button type="button" class="salesking_dynamic_rule_condition_delete_button salesking_condition_identifier_'+currentNumber+'">'+salesking.delete+'</button>');
			// add next condition
			$('#salesking_condition_number_'+currentNumber).after('<div id="salesking_condition_number_'+nextNumber+'" class="salesking_rule_condition_container">'+
				'<select class="salesking_dynamic_rule_condition_name salesking_condition_identifier_'+nextNumber+'">'+
					'<option value="cart_total_quantity" selected="selected">'+salesking.cart_total_quantity+'</option>'+
					'<option value="cart_total_value">'+salesking.cart_total_value+'</option>'+
					'<option value="category_product_quantity">'+salesking.category_product_quantity+'</option>'+
					'<option value="category_product_value">'+salesking.category_product_value+'</option>'+
					'<option value="product_quantity">'+salesking.product_quantity+'</option>'+
					'<option value="product_value">'+salesking.product_value+'</option>'+
				'</select>'+
				'<select class="salesking_dynamic_rule_condition_operator salesking_condition_identifier_'+nextNumber+'">'+
					'<option value="greater">'+salesking.greater+'</option>'+
					'<option value="equal">'+salesking.equal+'</option>'+
					'<option value="smaller">'+salesking.smaller+'</option>'+
				'</select>'+
				'<input type="number" step="0.00001" class="salesking_dynamic_rule_condition_number salesking_condition_identifier_'+nextNumber+'" placeholder="'+salesking.enter_quantity_value+'">'+
				'<button type="button" class="salesking_dynamic_rule_condition_add_button salesking_condition_identifier_'+nextNumber+'">'+salesking.add_condition+'</button>'+
			'</div>');

			// remove self 
			$('.salesking_dynamic_rule_condition_add_button.salesking_condition_identifier_'+currentNumber).remove();

			// update available options
			updateDynamicRulesOptionsConditions();
		}

		// On clicking "delete condition" in Dynamic rule
		$('body').on('click', '.salesking_dynamic_rule_condition_delete_button', function () {
			// get its current number
			let currentNumber;
			let classList = $(this).attr('class').split(/\s+/);
			$.each(classList, function(index, item) {
			    if (item.includes('identifier')) {
			    	var itemArray = item.split("_");
			    	currentNumber = parseInt(itemArray[3]);
			    }
			});
			// remove current element
			$('#salesking_condition_number_'+currentNumber).remove();

			// update conditions hidden field
			updateConditionsHiddenField();
		});

		// On Rule selector change, update dynamic rule conditions
		$('#salesking_rule_select_what, #salesking_rule_select_who, #salesking_rule_select_orders, #salesking_rule_select_agents_who, #salesking_rule_select_applies, #salesking_rule_select, #salesking_rule_select_showtax, #salesking_container_tax_shipping').change(function() {
			updateDynamicRulesOptionsConditions();
		});

		function updateDynamicRulesOptionsConditions(){
			$('#salesking_rule_select_applies_replaced_container').css('display','none');
			// Hide one-time fee
			$('#salesking_one_time').css('display','none');
			// Hide all condition options
			$('.salesking_dynamic_rule_condition_name option').css('display','none');
			// Hide quantity/value
			$('#salesking_container_quantity_value').css('display','none');
			// Hide currency
			$('#salesking_container_currency').css('display','none');
			// Hide payment methods
			$('#salesking_container_paymentmethods, #salesking_container_paymentmethods_minmax, #salesking_container_paymentmethods_percentamount').css('display','none');
			// Hide countries and requires
			$('#salesking_container_countries, #salesking_container_requires, #salesking_container_showtax').css('display','none');
			// Hide tax name
			$('#salesking_container_taxname, #salesking_container_tax_shipping, #salesking_container_tax_shipping_rate').css('display','none');
			// Hide discount checkbox
			$('.salesking_dynamic_rule_discount_show_everywhere_checkbox_container, .salesking_discount_options_information_box').css('display','none');
			$('#salesking_container_discountname').css('display','none');
			$('.salesking_rule_label_discount').css('display','none');
			$("#salesking_container_x").css('display','none');

			// conditions box text
			$('#salesking_rule_conditions_information_box_text').text(salesking.conditions_apply_cumulatively);

			// Show all options
			$("#salesking_container_howmuch").css('display','inline-block');
			$('#salesking_container_applies').css('display','inline-block');
			// Show conditions + conditions info box
			$('#salesking_rule_select_conditions_container').css('display','inline-block');
			$('.salesking_rule_conditions_information_box').css('display','flex');

			let selectedWhat = $("#salesking_rule_select_what").val();
			let selectedApplies = $("#salesking_rule_select_applies").val();
			let selectedOrders = $('#salesking_rule_select_orders').val();

			if (selectedOrders !== 'all' && selectedOrders !== 'all_agent' && selectedOrders !== 'all_earnings' && selectedOrders !== 'all_earnings_singlevalue'){
				$("#salesking_container_x").css('display','inline-block');
			}


			// Select Discount Amount or Percentage
			if (selectedWhat === 'discount_amount' || selectedWhat === 'discount_percentage'){
				// if select Cart: cart_total_quantity and cart_total_value
				if (selectedApplies === 'cart_total' || selectedApplies === 'excluding_multiple_options'){
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=cart_total_value]').css('display','block');
				} else if (selectedApplies.startsWith("category")){
				// if select Category also have: category_product_quantity and category_product_value
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=cart_total_value], .salesking_dynamic_rule_condition_name option[value=category_product_quantity], .salesking_dynamic_rule_condition_name option[value=category_product_value]').css('display','block');
				} else if (selectedApplies.startsWith("product")){
				// if select Product also have: product_quantity and product_value  
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=cart_total_value], .salesking_dynamic_rule_condition_name option[value=product_quantity], .salesking_dynamic_rule_condition_name option[value=product_value]').css('display','block');
				} else if (selectedApplies === 'multiple_options' || selectedApplies === 'excluding_multiple_options' || selectedApplies === 'replace_ids'){
					$('.salesking_dynamic_rule_condition_name option').css('display','block');
					// conditions box text
					$('#salesking_rule_conditions_information_box_text').text(salesking.conditions_multiselect);
				}
				// Show discount everywhere checkbox
				$('.salesking_dynamic_rule_discount_show_everywhere_checkbox_container, .salesking_discount_options_information_box').css('display','flex');
				$('.salesking_rule_label_discount').css('display','block');
				$('#salesking_container_discountname').css('display','inline-block');
			} else if (selectedWhat === 'fixed_price'){
				if (selectedApplies === 'cart_total'){
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=cart_total_value]').css('display','block');
				} else if (selectedApplies.startsWith("category")){
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=category_product_quantity]').css('display','block');
				} else if (selectedApplies.startsWith("product")){
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=product_quantity]').css('display','block');
				} else if (selectedApplies === 'multiple_options' || selectedApplies === 'replace_ids'){
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=category_product_quantity], .salesking_dynamic_rule_condition_name option[value=product_quantity]').css('display','block');
					$('#salesking_rule_conditions_information_box_text').text(salesking.conditions_multiselect);
				}
			} else if (selectedWhat === 'free_shipping'){
				// How much does not apply - hide
				$('#salesking_container_howmuch').css('display','none');
				// if select Cart: cart_total_quantity and cart_total_value
				if (selectedApplies === 'cart_total'){
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=cart_total_value]').css('display','block');
				} else if (selectedApplies.startsWith("category")){
				// if select Category also have: category_product_quantity and category_product_value
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=cart_total_value], .salesking_dynamic_rule_condition_name option[value=category_product_quantity], .salesking_dynamic_rule_condition_name option[value=category_product_value]').css('display','block');
				} else if (selectedApplies.startsWith("product")){
				// if select Product also have: product_quantity and product_value 
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=cart_total_value], .salesking_dynamic_rule_condition_name option[value=product_quantity], .salesking_dynamic_rule_condition_name option[value=product_value]').css('display','block'); 
				} else if (selectedApplies === 'multiple_options' || selectedApplies === 'replace_ids'){
					$('.salesking_dynamic_rule_condition_name option').css('display','block');
					$('#salesking_rule_conditions_information_box_text').text(salesking.conditions_multiselect);
				}
			} else if (selectedWhat === 'hidden_price'){
				// How much does not apply - hide
				$('#salesking_container_howmuch').css('display','none');
				// hide Conditions input and available conditions text
				$('#salesking_rule_select_conditions_container').css('display','none');
				$('.salesking_rule_conditions_information_box').css('display','none');

			} else if (selectedWhat === 'required_multiple'){

				// if select Cart: cart_total_quantity and cart_total_value
				if (selectedApplies === 'cart_total'){
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=cart_total_value]').css('display','block');
				} else if (selectedApplies.startsWith("category")){
				// if select Category also have: category_product_quantity and category_product_value
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=cart_total_value], .salesking_dynamic_rule_condition_name option[value=category_product_quantity], .salesking_dynamic_rule_condition_name option[value=category_product_value]').css('display','block');
				} else if (selectedApplies.startsWith("product")){
				// if select Product also have: product_quantity and product_value  
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=cart_total_value], .salesking_dynamic_rule_condition_name option[value=product_quantity], .salesking_dynamic_rule_condition_name option[value=product_value]').css('display','block');
				} else if (selectedApplies === 'multiple_options' || selectedApplies === 'replace_ids'){
					$('.salesking_dynamic_rule_condition_name option').css('display','block');
					$('#salesking_rule_conditions_information_box_text').text(salesking.conditions_multiselect);
				}

			} else if (selectedWhat === 'minimum_order' || selectedWhat === 'maximum_order' ) {
				// show Quantity/value
				$('#salesking_container_quantity_value').css('display','inline-block');
				// hide Conditions input and available conditions text
				$('#salesking_rule_select_conditions_container').css('display','none');
				$('.salesking_rule_conditions_information_box').css('display','none');
			} else if (selectedWhat === 'tax_exemption' ) {
				// How much does not apply - hide
				$('#salesking_container_howmuch').css('display','none');
				// show countries and requires
				$('#salesking_container_countries, #salesking_container_requires').css('display','inline-block');
				// hide Conditions input and available conditions text
				$('#salesking_rule_select_conditions_container').css('display','none');
				$('.salesking_rule_conditions_information_box').css('display','none');
			} else if (selectedWhat === 'tax_exemption_user' ) {
				// How much does not apply - hide
				$('#salesking_container_howmuch').css('display','none');
				// Applies does not apply - hide
				$('#salesking_container_applies').css('display','none');
				// show countries and requires
				$('#salesking_container_countries, #salesking_container_requires, #salesking_container_showtax').css('display','inline-block');
				if ($('#salesking_rule_select_showtax').val() === 'display_only'){
					$('#salesking_container_tax_shipping').css('display','inline-block');
					if ($('#salesking_rule_select_tax_shipping').val() === 'yes'){
						$('#salesking_container_tax_shipping_rate').css('display', 'inline-block');
					}
				}
				// hide Conditions input and available conditions text
				$('#salesking_rule_select_conditions_container').css('display','none');
				$('.salesking_rule_conditions_information_box').css('display','none');
			} else if (selectedWhat === 'add_tax_amount' || selectedWhat === 'add_tax_percentage' ) {
				// show one time
				$('#salesking_one_time').css('display','inline-block');
				// show tax name
				$('#salesking_container_taxname').css('display','inline-block');
				if (selectedApplies === 'one_time' && selectedWhat === 'add_tax_percentage'){
					$('#salesking_container_tax_shipping').css('display','inline-block');
				}
				// if select Cart: cart_total_quantity and cart_total_value
				if (selectedApplies === 'cart_total' || selectedApplies === 'one_time'){
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=cart_total_value]').css('display','block');
				} else if (selectedApplies.startsWith("category")){
				// if select Category also have: category_product_quantity and category_product_value
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=cart_total_value], .salesking_dynamic_rule_condition_name option[value=category_product_quantity], .salesking_dynamic_rule_condition_name option[value=category_product_value]').css('display','block');
				} else if (selectedApplies.startsWith("product")){
				// if select Product also have: product_quantity and product_value  
					$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=cart_total_value], .salesking_dynamic_rule_condition_name option[value=product_quantity], .salesking_dynamic_rule_condition_name option[value=product_value]').css('display','block');
				} else if (selectedApplies === 'multiple_options' || selectedApplies === 'replace_ids'){
					$('.salesking_dynamic_rule_condition_name option').css('display','block');
					$('#salesking_rule_conditions_information_box_text').text(salesking.conditions_multiselect);
				}
			} else if (selectedWhat === 'replace_prices_quote'){
				// How much does not apply - hide
				$('#salesking_container_howmuch, #salesking_container_applies').css('display','none');
				// hide Conditions input and available conditions text
				$('#salesking_rule_select_conditions_container').css('display','none');
				$('.salesking_rule_conditions_information_box').css('display','none');
			} else if (selectedWhat === 'rename_purchase_order'){
				// How much does not apply - hide
				$('#salesking_container_howmuch, #salesking_container_applies').css('display','none');
				// hide Conditions input and available conditions text
				$('#salesking_rule_select_conditions_container').css('display','none');
				$('.salesking_rule_conditions_information_box').css('display','none');
				$('#salesking_container_taxname').css('display','inline-block');
			} else if (selectedWhat === 'set_currency_symbol'){
				// How much does not apply - hide
				$('#salesking_container_howmuch, #salesking_container_applies').css('display','none');
				// hide Conditions input and available conditions text
				$('#salesking_rule_select_conditions_container').css('display','none');
				$('.salesking_rule_conditions_information_box').css('display','none');
				$('#salesking_container_currency').css('display','inline-block');
			} else if (selectedWhat === 'payment_method_minmax_order'){
				// How much does not apply - hide
				$('#salesking_container_applies').css('display','none');
				// hide Conditions input and available conditions text
				$('#salesking_rule_select_conditions_container').css('display','none');
				$('.salesking_rule_conditions_information_box').css('display','none');
				$('#salesking_container_paymentmethods, #salesking_container_paymentmethods_minmax').css('display','inline-block');
			}  else if (selectedWhat === 'payment_method_discount'){
				// How much does not apply - hide
				$('#salesking_container_applies').css('display','none');
				// hide Conditions input and available conditions text
				$('#salesking_rule_select_conditions_container').css('display','none');
				$('.salesking_rule_conditions_information_box').css('display','none');
				$('#salesking_container_paymentmethods, #salesking_container_paymentmethods_percentamount').css('display','inline-block');
			}  else if (selectedWhat === 'bogo_discount'){
				$('.salesking_dynamic_rule_condition_name option[value=cart_total_quantity], .salesking_dynamic_rule_condition_name option[value=cart_total_value], .salesking_dynamic_rule_condition_name option[value=category_product_quantity], .salesking_dynamic_rule_condition_name option[value=category_product_value]').css('display','block');
				$('.salesking_dynamic_rule_condition_name option[value=product_quantity], .salesking_dynamic_rule_condition_name option[value=product_value]').css('display','block');

			} 
			if (selectedApplies === 'replace_ids' && selectedWhat !== 'tax_exemption_user'){
				$('#salesking_rule_select_applies_replaced_container').css('display','block');
			}


			if (selectedOrders === 'all_earnings' || selectedOrders === 'all_earnings_singlevalue' || selectedOrders === 'reach_x_number' || selectedOrders === 'first_x_earnings' || selectedOrders === 'first_x_days'){
				$('#salesking_container_applies, #salesking_container_forcustomers, #salesking_select_multiple_product_categories_selector, #salesking_select_multiple_users_selector').css('display','none');
			} else {
				$('#salesking_container_applies, #salesking_container_forcustomers').css('display','inline-block');
				if (selectedApplies === 'multiple_options'){
					$('#salesking_select_multiple_product_categories_selector').css('display','block');
				}
				if ($('#salesking_rule_select_who').val() === 'multiple_options'){
					$('#salesking_select_multiple_users_selector').css('display','block');
				}
			}

			// Check all conditions. If selected condition what is display none, change to Cart Total Quantity (available for all)
			$(".salesking_dynamic_rule_condition_name").each(function (i) {
				let selected = $(this).val();
				let selectedOption = $(this).find("option[value="+selected+"]");
				if (selectedOption.css('display')==='none'){
					$(this).val('cart_total_quantity');
				}
			});

			// Update Conditions
			updateConditionsHiddenField();
		}

		// On condition text change, update conditions hidden field
		$('body').on('input', '.salesking_dynamic_rule_condition_number, .salesking_dynamic_rule_condition_operator, .salesking_dynamic_rule_condition_name', function () {
			updateConditionsHiddenField();
		});

		function updateConditionsHiddenField(){
			// Clear condtions field
			$('#salesking_rule_select_conditions').val('');
			// For each condition, if not empty, add to field
			let conditions = '';

			$(".salesking_dynamic_rule_condition_name").each(function (i) {
				// get its current number
				let currentNumber;
				let classList = $(this).attr('class').split(/\s+/);
				$.each(classList, function(index, item) {
				    if (item.includes('identifier')) {
				    	var itemArray = item.split("_");
				    	currentNumber = parseInt(itemArray[3]);
				    }
				});

				let numberField = $(".salesking_dynamic_rule_condition_number.salesking_condition_identifier_"+currentNumber).val();
				if (numberField === undefined){
					numberField = '';
				}

				if (numberField.trim() !== ''){
					conditions+=$(this).val()+';';
					conditions+=$(".salesking_dynamic_rule_condition_operator.salesking_condition_identifier_"+currentNumber).val()+';';
					conditions+=$(".salesking_dynamic_rule_condition_number.salesking_condition_identifier_"+currentNumber).val()+'|';
				}
			});
			// remove last character
			conditions = conditions.substring(0, conditions.length - 1);
			$('#salesking_rule_select_conditions').val(conditions);
		}

		
		/* REGISTRATION FIELD */
	
		// show hide Registration Role Automatic Approval - show only if automatic approval is selected
		showHideAutomaticApprovalGroup();
		$('.salesking_custom_role_settings_metabox_container_element_select').change(showHideAutomaticApprovalGroup);
		function showHideAutomaticApprovalGroup(){
			let selectedValue = $('.salesking_custom_role_settings_metabox_container_element_select').val();
			if (selectedValue === 'automatic'){
				$('.salesking_automatic_approval_customer_group_container').css('display','block');
			} else {
				$('.salesking_automatic_approval_customer_group_container').css('display','none');
			}
		}

		// show hide multiple roles selector
		showHideMultipleRolesSelector();
		$('.salesking_custom_field_settings_metabox_top_column_registration_role_select').change(showHideMultipleRolesSelector);
		function showHideMultipleRolesSelector(){
			let selectedValue = $('.salesking_custom_field_settings_metabox_top_column_registration_role_select').val();
			if (selectedValue === 'multipleroles'){
				$('#salesking_select_multiple_roles_selector').css('display','block');
			} else {
				$('#salesking_select_multiple_roles_selector').css('display','none');
			}
		}



		// VENDOR BALANCE HISTORY
	    // On clicking "Save Adjustment"
	   	$('body').on('click', '#salesking_make_vendor_balance_adjustment', function(e) {
	    	var amount = $('#salesking_adjustment_value').val();
	    	var note = $('#salesking_adjustment_note').val();
	    	var uid = $('input[name=salesking_admin_user_id]').val();

	    	if (confirm(salesking.sure_save_adjustment)){
				var datavar = {
		            action: 'saleskingsaveadjustment',
		            security: salesking.security,
		            pamount: amount,
		            pnote: note,
		            userid: uid,
		        };

				$.post(ajaxurl, datavar, function(response){
					window.location.reload();
				});
	    	}
	    });

	    $('body').on('click','#salesking_download_vendor_balance_history', function(){
	    	let user_id = $('#salesking_download_vendor_balance_history').val();
	    	window.location = ajaxurl + '?action=salesking_download_vendor_balance_history&userid='+user_id+'&security=' + salesking.security;
	    	console.log(ajaxurl + '?action=salesking_download_vendor_balance_history&userid='+user_id+'&security=' + salesking.security);

	    });

	    // REPORTS
	   setTimeout(function(){

	   	// draw chart
	   	drawSalesChart();

	   	$('#salesking_dashboard_days_select').change(drawSalesChart);

	   	// load first chart in reports
	   	setTimeout(function(){
	   		$('#salesking_reports_link_thismonth').click();
	   	}, 150);
	
	   	
	   }, 35);

	   /*
	   * Draw the Sales Chart
	   */
	   function drawSalesChart(){
	   	// dashboard but not reports
	   	
	   	if ($(".salesking_dashboard_page_wrapper").val()!== undefined && $(".salesking_reports_page_wrapper").val()=== undefined ){
	   	    var selectValue = parseInt($('#salesking_dashboard_days_select').val());
	   	    $('#salesking_dashboard_blue_button').text($('#salesking_dashboard_days_select option:selected').text());

	   	    if (selectValue === 0){
	   	        $('.salesking_total_b2b_sales_seven_days,.salesking_total_b2b_sales_thirtyone_days, .salesking_number_orders_seven, .salesking_number_orders_thirtyone, .salesking_number_customers_seven, .salesking_number_customers_thirtyone, .salesking_net_earnings_seven, .salesking_net_earnings_thirtyone').css('display', 'none');
	   	        $('.salesking_total_b2b_sales_today, .salesking_number_orders_today, .salesking_number_customers_today, .salesking_net_earnings_today').css('display', 'block');
	   	    } else if (selectValue === 1){
	   	        $('.salesking_total_b2b_sales_today,.salesking_total_b2b_sales_thirtyone_days, .salesking_number_orders_today, .salesking_number_orders_thirtyone, .salesking_number_customers_today, .salesking_number_customers_thirtyone, .salesking_net_earnings_today, .salesking_net_earnings_thirtyone').css('display', 'none');
	   	        $('.salesking_total_b2b_sales_seven_days, .salesking_number_orders_seven, .salesking_number_customers_seven, .salesking_net_earnings_seven').css('display', 'block');
	   	    } else if (selectValue === 2){
	   	        $('.salesking_total_b2b_sales_today,.salesking_total_b2b_sales_seven_days, .salesking_number_orders_today, .salesking_number_orders_seven, .salesking_number_customers_today, .salesking_number_customers_seven, .salesking_net_earnings_today, .salesking_net_earnings_seven').css('display', 'none');
	   	        $('.salesking_total_b2b_sales_thirtyone_days, .salesking_number_orders_thirtyone, .salesking_number_customers_thirtyone, .salesking_net_earnings_thirtyone').css('display', 'block');
	   	    }

	   	    if (selectValue === 0){
	   	        // set label
	   	        var labelsdraw = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'];
	   	        // set series
	   	        var seriesdrawb2b = salesking_dashboard.hours_sales_b2b.concat();
	   	        

	   	    } else if (selectValue === 1){
	   	        // set label
	   	        var date = new Date();
	   	        var d = date.getDate();
	   	        var labelsdraw = [d-6, d-5, d-4, d-3, d-2, d-1, d];
	   	        labelsdraw.forEach(myFunction);
	   	        function myFunction(item, index) {
	   	          if (parseInt(item)<=0){
	   	            let last = new Date();
	   	            let month = last.getMonth()-1;
	   	            let year = last.getFullYear();
	   	            let lastMonthDays = new Date(year, month, 0).getDate();
	   	            labelsdraw[index] = lastMonthDays+item;
	   	          }
	   	        }
	   	        // set series

	   	        var seriesdrawb2b = salesking_dashboard.days_sales_b2b.concat();
	   	        seriesdrawb2b.splice(7,24);
	   	        seriesdrawb2b.reverse();
	   	    } else if (selectValue === 2){
	   	        // set label
	   	        var labelsdraw = [];
	   	        let i = 0;
	   	        while (i<31){
	   	            let now = new Date();
	   	            let pastDate = new Date(now.setDate(now.getDate() - i));
	   	            let day = pastDate.getDate();
	   	            labelsdraw.unshift(day);
	   	            i++;
	   	        }
	   	        // set series
	   	        var seriesdrawb2b = salesking_dashboard.days_sales_b2b.concat();
	   	        seriesdrawb2b.reverse();
	   	    }

	   	    var chart = new Chartist.Line('.campaign', {
	   	        labels: labelsdraw,
	   	        series: [
	   	            seriesdrawb2b,
	   	        ]
	   	    }, {
	   	        low: 0,
	   	        high: Math.max(seriesdrawb2b),

	   	        showArea: true,
	   	        fullWidth: true,
	   	        plugins: [
	   	            Chartist.plugins.tooltip()
	   	        ],
	   	        axisY: {
	   	            onlyInteger: true,
	   	            scaleMinSpace: 40,
	   	            offset: 55,
	   	            labelInterpolationFnc: function(value) {
	   	                return salesking_dashboard.currency_symbol + (value / 1);
	   	            }
	   	        },
	   	    });

	   	    // Offset x1 a tiny amount so that the straight stroke gets a bounding box
	   	    // Straight lines don't get a bounding box 
	   	    // Last remark on -> http://www.w3.org/TR/SVG11/coords.html#ObjectBoundingBox
	   	    chart.on('draw', function(ctx) {
	   	        if (ctx.type === 'area') {
	   	            ctx.element.attr({
	   	                x1: ctx.x1 + 0.001
	   	            });
	   	        }
	   	    });

	   	    // Create the gradient definition on created event (always after chart re-render)
	   	    chart.on('created', function(ctx) {
	   	        var defs = ctx.svg.elem('defs');
	   	        defs.elem('linearGradient', {
	   	            id: 'gradient',
	   	            x1: 0,
	   	            y1: 1,
	   	            x2: 0,
	   	            y2: 0
	   	        }).elem('stop', {
	   	            offset: 0,
	   	            'stop-color': 'rgba(255, 255, 255, 1)'
	   	        }).parent().elem('stop', {
	   	            offset: 1,
	   	            'stop-color': 'rgba(64, 196, 255, 1)'
	   	        });
	   	    });

	   	    var chart = [chart];
	   	}
	   }

	   /* Reports Sales Chart */
	   function drawReportsSalesChart(labelsdraw, salestotal, ordernumbers, commissiontotal){
	   	// dashboard but not reports
	   	
	   	if ($(".salesking_reports_page_wrapper").val()!== undefined ){
	   	    var selectValue = parseInt($('#salesking_dashboard_days_select').val());
	   	    $('#salesking_dashboard_blue_button').text($('#salesking_dashboard_days_select option:selected').text());

	   	    var chart = new Chartist.Line('.campaign', {
	   	        labels: labelsdraw,
	   	        series: [
	   	            salestotal,commissiontotal
	   	        ]
	   	    }, {
	   	        low: 0,
	   	        high: Math.max(commissiontotal,salestotal),

	   	        showArea: true,
	   	        fullWidth: true,
	   	        plugins: [
	   	            Chartist.plugins.tooltip()
	   	        ],
	   	        axisY: {
	   	            onlyInteger: true,
	   	            scaleMinSpace: 40,
	   	            offset: 55,
	   	            labelInterpolationFnc: function(value) {
	   	                return salesking_dashboard.currency_symbol + (value / 1);
	   	            }
	   	        },
	   	    });

	   	    var chart = new Chartist.Line('.campaign2', {
	   	        labels: labelsdraw,
	   	        series: [
	   	            [],ordernumbers
	   	        ]
	   	    }, {
	   	        low: 0,
	   	        high: Math.max(ordernumbers),

	   	        showArea: true,
	   	        fullWidth: true,
	   	        plugins: [
	   	            Chartist.plugins.tooltip()
	   	        ],
	   	        axisY: {
	   	            onlyInteger: true,
	   	            scaleMinSpace: 40,
	   	            offset: 55,
	   	        },
	   	    });

	   	    // Offset x1 a tiny amount so that the straight stroke gets a bounding box
	   	    // Straight lines don't get a bounding box 
	   	    // Last remark on -> http://www.w3.org/TR/SVG11/coords.html#ObjectBoundingBox
	   	    chart.on('draw', function(ctx) {
	   	        if (ctx.type === 'area') {
	   	            ctx.element.attr({
	   	                x1: ctx.x1 + 0.001
	   	            });
	   	        }
	   	    });

	   	    // Create the gradient definition on created event (always after chart re-render)
	   	    chart.on('created', function(ctx) {
	   	        var defs = ctx.svg.elem('defs');
	   	        defs.elem('linearGradient', {
	   	            id: 'gradient',
	   	            x1: 0,
	   	            y1: 1,
	   	            x2: 0,
	   	            y2: 0
	   	        }).elem('stop', {
	   	            offset: 0,
	   	            'stop-color': 'rgba(255, 255, 255, 1)'
	   	        }).parent().elem('stop', {
	   	            offset: 1,
	   	            'stop-color': 'rgba(64, 196, 255, 1)'
	   	        });
	   	    });

	   	    var chart = [chart];
	   	}
	   }
	   function reports_set_chart(){
	   	let vendor = jQuery('#salesking_dashboard_days_select').val();
	   	let firstday = jQuery('.salesking_reports_date_input_from').val();
	   	let lastday = jQuery('.salesking_reports_date_input_to').val();

	   	// if dates are set
	   	if (firstday !== '' && lastday !== ''){

	   		// get data
	   		var datavar = {
	               action: 'salesking_reports_get_data',
	               security: salesking.security,
	               vendor: vendor,
	               firstday: firstday,
	               lastday: lastday,
	           };

	   		$.post(ajaxurl, datavar, function(response){

	   			let data = response.split('*');
	   			let sales_total = data[0];
	   			let sales_total_wc = data[1];
	   			let order_number = data[2];
	   			let new_vendors = data[3];
	   			let commission = data[4];
	   			let commission_wc = data[5];
	   			let labels = JSON.parse(data[6]);
	   			let salestotal = JSON.parse(data[7]);
	   			let ordernumbers = JSON.parse(data[8]);
	   			let commissiontotal = JSON.parse(data[9]);

	   			$('.salesking_reports_page_wrapper .salesking_total_b2b_sales_today').html(sales_total_wc);
	   			$('.salesking_number_orders_today').html(order_number);
	   			$('.salesking_number_customers_today').html(new_vendors);
	   			$('.salesking_net_earnings_today').html(commission_wc);

	   			drawReportsSalesChart(labels,salestotal, ordernumbers, commissiontotal);

	   		});
	   	}


	   }
	   $('body').on('click', '.salesking_reports_link' ,function(){
	   	let quicklink = jQuery(this).prop('hreflang');

	   	if (quicklink === 'thismonth'){
	   		var date = new Date(), y = date.getFullYear(), m = date.getMonth();
	   		var firstDay = new Date(y, m, 1);
	   		var lastDay = new Date(y, m + 1, 0);

	   	}

	   	if (quicklink === 'lastmonth'){
	   		var date = new Date(), y = date.getFullYear(), m = date.getMonth()-1;

	   		var firstDay = new Date(y, m, 1);
	   		var lastDay = new Date(y, m + 1, 0);
	   	}

	   	if (quicklink === 'thisyear'){
	   		var date = new Date(), y = date.getFullYear();
	   		var firstDay = new Date(y, 0, 1);
	   		var lastDay = new Date(y, 11, 31);

	   	}
	   	if (quicklink === 'lastyear'){
	   		var date = new Date(), y = date.getFullYear()-1;
	   		var firstDay = new Date(y, 0, 1);
	   		var lastDay = new Date(y, 11, 31);

	   	}


	   	var day = firstDay.getDate();
	   		if (day<10) { day="0"+day;}

	   	var month = firstDay.getMonth()+1;
	   	if (month<10) { month="0"+month;}

	   	jQuery('.salesking_reports_date_input_from').val(firstDay.getFullYear()+'-'+month+'-'+day);

	   	var day = lastDay.getDate();
	   		if (day<10) { day="0"+day;}

	   	var month = lastDay.getMonth()+1;
	   	if (month<10) { month="0"+month;}

	   	jQuery('.salesking_reports_date_input_to').val(lastDay.getFullYear()+'-'+month+'-'+day);

	   	reports_set_chart();
	   
	   });

	   $('body').on('change', '.salesking_reports_date_input', function(){
	   	reports_set_chart();
	   });
	   $('body').on('change', '#salesking_dashboard_days_select', function(){
	   	reports_set_chart();
	   });

 
	});

})(jQuery);