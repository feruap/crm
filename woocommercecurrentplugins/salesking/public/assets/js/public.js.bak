/**
*
* JavaScript file that handles public side JS
*
*/
(function($){

	"use strict";

	$( document ).ready(function() {

		// Fix icons loading issue
		failsafeicons();
		setTimeout(function(){
			failsafeicons();
		}, 500);
		function failsafeicons(){
			if (jQuery('.ni-comments').val()!==undefined){
				if(getComputedStyle(document.querySelector('.ni-comments'), ':before').getPropertyValue('content') === '"î²Ÿ"'){
					reloaddashlite();
				}
			}
		}
		function reloaddashlite(){
			let hrnew = jQuery('#salesking_dashboard-css').attr('href')+1;
			jQuery('#salesking_dashboard-css').attr('href', hrnew);
		}

		// Move body to stay below top switched used bar
		setTimeout(function(){
			if ($('#salesking_agent_switched_bar').css('height') !== undefined){
				let heightpx = jQuery('#salesking_agent_switched_bar').css('height');
				jQuery('body').css('padding-top', heightpx);
			}
		}, 100);

		// set cookies via browser to ensure correct values
		function getParameterByName(name) {
	        const url = window.location.href;
	        name = name.replace(/[\[\]]/g, "\\$&");
	        const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
	              results = regex.exec(url);
	        if (!results) return null;
	        if (!results[2]) return '';
	        return decodeURIComponent(results[2].replace(/\+/g, " "));
	    }

	    function setCookie(name, value, days) {
	        const date = new Date();
	        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
	        const expires = "expires=" + date.toUTCString();
	        document.cookie = name + "=" + value + ";" + expires + ";path=/";
	    }

	    const regid = getParameterByName('regid');
	    const affid = getParameterByName('affid');

	    if (regid) {
	        setCookie('salesking_registration_cookie', regid, 1);
	        setCookie('salesking_affiliate_cookie', regid, 1);
	    } else if (affid) {
	        setCookie('salesking_registration_cookie', affid, 1);
	        setCookie('salesking_affiliate_cookie', affid, 1);
	    }
		
		
		// On clicking "Mark as read" for announcements
		$('#salesking_mark_announcement_read').on('click', function(){
			// Run ajax request
			var datavar = {
	            action: 'saleskingmarkread',
	            security: salesking_display_settings.security,
	            announcementid: $('#salesking_mark_announcement_read').val(),
	        };

			$.post(salesking_display_settings.ajaxurl, datavar, function(response){
				window.location = salesking_display_settings.announcementsurl;
			});
		});

		// On clicking "Mark all as read" for announcements
		$('#salesking_mark_all_announcement_read').on('click', function(){
			// Run ajax request
			var datavar = {
	            action: 'saleskingmarkallread',
	            security: salesking_display_settings.security,
	            announcementsid: $('#salesking_mark_all_announcement_read').val(),
	        };

			$.post(salesking_display_settings.ajaxurl, datavar, function(response){
				window.location = salesking_display_settings.announcementsurl;
			});
		});

		// clear initially to clear savestate
		setTimeout(function(){
			$('.salesking_earnings_page .form-control.form-control-sm, .salesking_customers_page .form-control.form-control-sm, .salesking_teams_page .form-control.form-control-sm, .salesking_orders_page .form-control.form-control-sm').val('').change().trigger('input');
		}, 200);

		// On clicking "Mark as read" for conversations
		$('#salesking_mark_conversation_read').on('click', function(){
			// Run ajax request
			var datavar = {
	            action: 'saleskingmarkreadmessage',
	            security: salesking_display_settings.security,
	            messageid: $('#salesking_mark_conversation_read').val(),
	            messagetype: $('#salesking_mark_conversation_read').data('type'),
	        };

			$.post(salesking_display_settings.ajaxurl, datavar, function(response){
				window.location.reload();
			});
		});

		// On clicking "Mark as closed" for conversations
		$('#salesking_mark_conversation_closed').on('click', function(){
			// Run ajax request
			var datavar = {
	            action: 'saleskingmarkclosedmessage',
	            security: salesking_display_settings.security,
	            messageid: $('#salesking_mark_conversation_closed').val(),
	            messagetype: $('#salesking_mark_conversation_closed').data('type'),
	        };

			$.post(salesking_display_settings.ajaxurl, datavar, function(response){
				window.location.reload();
			});
		});



		// On click Send in existing conversation
		$('#salesking_dashboard_reply_message').on('click', function(){

			// Run ajax request
			var datavar = {
	            action: 'saleskingreplymessage',
	            security: salesking_display_settings.security,
	            messagecontent: $('#salesking_dashboard_reply_message_content').val(),
	            messageid: $(this).val(),
	            messagetype: $(this).data('type'),
	        };

			$.post(salesking_display_settings.ajaxurl, datavar, function(response){
				window.location.reload();
			});
		});

		// On click Make Offer button
		$('#salesking_make_offer').on('click', function(){
			var conversationId = $(this).val();
			var offersUrl = salesking_display_settings.offers_link + '?quote=' + conversationId;
			window.location.href = offersUrl;
		});

		// On clicking send (compose message)
		$('#salesking_compose_send_message').on('click', function(){

			// Run ajax request
			var datavar = {
	            action: 'saleskingcomposemessage',
	            security: salesking_display_settings.security,
	            messagecontent: $('#salesking_compose_send_message_content').val(),
	            recipient: $('#salesking_dashboard_recipient').val(),
	            title: $('#salesking_compose_send_message_title').val(),
	        };

			$.post(salesking_display_settings.ajaxurl, datavar, function(response){
				window.location = response;
			});
		});

		var buttonclass = 'btn btn-sm btn-gray';

		// Initiate customers frontend table

		if(salesking_display_settings.pdf_download_lang === 'chinese'){
			pdfMake.fonts = {
			  Noto: {
			    normal: 'Noto.ttf',
			    bold: 'Noto.ttf',
			    italics: 'Noto.ttf',
			    bolditalics: 'Noto.ttf'
			  }
			};
		}

		// OFFERS INTEGRATION START
		var mainTable = $('#salesking_dashboard_offers_table').DataTable({
			"language": {
			    "url": salesking_display_settings.datatables_folder+salesking_display_settings.tables_language_option+'.json'
			},
			oLanguage: {
                sSearch: ""
            },
            stateSave: true,
            dom: 'Bfrtip',
            buttons: {
                buttons: [
                    { extend: 'csvHtml5', className: buttonclass, text: '↓ CSV', exportOptions: { columns: ":visible" } },
                    { extend: 'pdfHtml5', className: buttonclass, text: '↓ PDF', exportOptions: { columns: ":visible" }, customize: function(doc) {
		              doc.defaultStyle.font = salesking_display_settings.pdf_download_font;
		          } },
                    { extend: 'print', className: buttonclass, text: salesking_display_settings.print, exportOptions: { columns: ":visible" } },
                    { extend: 'colvis', className: buttonclass, text: salesking_display_settings.edit_columns },
                ]
            }
		});


		$('#salesking_offers_search').keyup(function(){
		      mainTable.search($(this).val()).draw() ;
		});

		// when page opens, check if quote is set (response to make offer)
		let params = (new URL(document.location)).searchParams;
		let quote = params.get('quote'); // is the string "Jonathan Smith".
		if (quote !== null && quote !== ''){
		    // we have a number
		    let quotenr = parseInt(quote);
		    setTimeout(function(){
		        $('.b2bking_salesking_new_offer').click();
		    }, 100);

		    // get values via AJAX and load into edit
		    // first run ajax call based on the offer id
		    var datavar = {
		        action: 'b2bking_get_offer_data_sk',
		        security: salesking_display_settings.security,
		        quoteid: quotenr
		    };

		    $.post(salesking_display_settings.ajaxurl, datavar, function(response){
		       var results = response;
		       var resultsArray = results.split('*');
		       // load values into fields
		       $('#b2bking_admin_offer_textarea').val(resultsArray[2]);
		       $('#b2bking_category_users_textarea').val(resultsArray[0]);
		       $('#b2bking_offer_customtext_textarea').val(resultsArray[3]);
		    
		        offerRetrieveHiddenField();
		        offerCalculateTotals();
		    });
		}

		// When New Offer modalzz is opened
		$('body').on('click', '.b2bking_salesking_new_offer', openOffermodalzz);
		function openOffermodalzz(){
		    clearOfferValues();
		    $('.b2bking_salesking_save_new_offer').val('new');
		    setTimeout(function(){
		        $('.b2bking_offer_product_selector').select2();
		    }, 200);
		}

		// on change item, set price per unit
		jQuery('body').on('change', '.b2bking_offer_product_selector', function($ab){
			let price = jQuery(this).find('option:selected').data('price');
			if (price !== '' && price !== undefined){
				$(this).parent().parent().find('.b2bking_offer_item_price').val(price);
				offerCalculateTotals();
			}
		});

		// Delete offer 
		$('body').on('click', '.b2bking_offer_delete_table', function(){
		    let offer = $(this).val();
		    if (confirm(salesking_display_settings.are_you_sure_delete_offer)){
		        var datavar = {
		            action: 'b2bking_delete_ajax_offer_sk',
		            security: salesking_display_settings.security,
		            offerid: offer,
		            userid: $('#b2bking_new_offer_user_id').val()
		        };
		        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
		           window.location.reload();
		        });
		    }
		});

		function clearOfferValues(){
		    $('.b2bking_salesking_email_offer').remove();
		    $('.b2bking_group_visibility_container_content_checkbox_input').prop('checked',false);
		    $('#b2bking_category_users_textarea').val('');
		    $('#b2bking_offer_customtext_textarea').val('');
		    $('#b2bking_new_offer_title').val('');
		    $('.b2bking_offer_line_number').each(function(){
		        // remove all except first
		        if ($(this).attr('ID') !== 'b2bking_offer_number_1'){
		            $(this).remove();
		        }
		        // clear first
		        $('#b2bking_offer_number_1 .b2bking_offer_text_input').val('');
		        $('#b2bking_offer_number_1 .b2bking_offer_product_selector').val('').trigger('change');
		        offerCalculateTotals();
		        offerSetHiddenField();
		    });
		}

		// Email Offer
		$('body').on('click', '.b2bking_salesking_email_offer', function(){
		    let offeridd = $(this).val();

		    if (confirm(salesking_display_settings.email_offer_confirm)){
		        var datavar = {
		            action: 'b2bking_email_offer_sk',
		            security: salesking_display_settings.security,
		            offerid: offeridd,
		            offerlink: salesking_display_settings.offers_endpoint_link,
		        };

		        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
		           
		           alert(salesking_display_settings.email_has_been_sent);
		        });
		    }
		});

		// Edit Offer
		$('body').on('click', '.b2bking_offer_edit_table', function (){
		    var offer_id = $(this).val();
		    // clear all values
		    clearOfferValues();
		    
		    setTimeout(function(){
		        // set button for save offer
		        $('.b2bking_salesking_save_new_offer').val(offer_id);

		        // add email offer button
		        $('.b2bking_salesking_save_new_offer').after('<button type="button" value="'+offer_id+'" class="btn btn-secondary salesking-btn salesking-btn-theme b2bking_salesking_email_offer">'+salesking_display_settings.email_offer+'</button>');
		      
		    }, 200);
		    // get values via AJAX and load into edit
		    // first run ajax call based on the offer id
		    var datavar = {
		        action: 'b2bking_get_offer_data_sk',
		        security: salesking_display_settings.security,
		        offerid: offer_id,
		        userid: $('#b2bking_new_offer_user_id').val()
		    };

		    $.post(salesking_display_settings.ajaxurl, datavar, function(response){
		       var results = response;
		       var resultsArray = results.split('*');
		       // load values into fields
		       $('#b2bking_offer_customtext_textarea').val(decodeHtmlEntities(resultsArray[3]));
	           $('#b2bking_admin_offer_textarea').val(decodeHtmlEntities(resultsArray[2]));
	           $('#b2bking_category_users_textarea').val(decodeHtmlEntities(resultsArray[0]));
	           $('#b2bking_new_offer_title').val(decodeHtmlEntities(resultsArray[4]));
		        // foreach group visible
		        let groups = resultsArray[1].split(',');
		        groups.forEach((element) => {
		        	if (element !== ''){
	        		    $('#'+element).prop('checked', true);
		        	}
		        });
		        offerRetrieveHiddenField();
		        offerCalculateTotals();
		    });
		});

		// Helper function to decode HTML entities
	    function decodeHtmlEntities(str) {
	        const textarea = document.createElement('textarea');
	        textarea.innerHTML = str;
	        return textarea.value;
	    }

		// Save Offers
		$('.b2bking_salesking_save_new_offer').on('click', function(){
		    var vall = $(this).val();
		    if (!$('#b2bking_new_offer_title').val()){
		        alert(salesking_display_settings.offer_must_have_title);
		        return;
		    }
		    if (!$('#b2bking_admin_offer_textarea').val()){
		        alert(salesking_display_settings.offer_must_have_product);
		        return;
		    }

		    if (confirm(salesking_display_settings.are_you_sure_save_offer)){
		        var datavar = {
		            action: 'b2bking_save_new_ajax_offer_sk',
		            security: salesking_display_settings.security,
		            uservisibility: $('#b2bking_category_users_textarea').val(),
		            customtext: $('#b2bking_offer_customtext_textarea').val(),
		            offerdetails: $('#b2bking_admin_offer_textarea').val(),
		            userid: $('#b2bking_new_offer_user_id').val(),
		            offertitle: $('#b2bking_new_offer_title').val(),
		            newedit: $('.b2bking_salesking_save_new_offer').val()
		        };

		        // send quote
		        let quote = params.get('quote'); // is the string "Jonathan Smith".
		        if (quote !== null && quote !== ''){
		            datavar.b2bking_quote_response = quote;
		        }

		       //  b2bking_group_visibility_container_content
		        // for each checkbox adde
		        var groupvisibilitytext = '';
		        $('.b2bking_group_visibility_container_content_checkbox_input:checkbox:checked').each(function(){
		            groupvisibilitytext += $(this).attr('name')+',';
		        });

		        datavar.groupvisibility = groupvisibilitytext;

		        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
		            var offeridd = response;
		            // ask if email the offer
		            if (vall === 'new'){
		                if (confirm(salesking_display_settings.also_email_offer)){
		                        var datavar = {
		                            action: 'b2bking_email_offer_sk',
		                            security: salesking_display_settings.security,
		                            offerid: offeridd,
		                            offerlink: salesking_display_settings.offers_endpoint_link,
		                        };

		                        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
		                           alert(salesking_display_settings.email_has_been_sent);
		                           window.location=salesking_display_settings.offers_link;
		                        });
		                } else {
		                    window.location=salesking_display_settings.offers_link;
		                }
		            } else {
		                window.location=salesking_display_settings.offers_link;
		            }
		            
		        });
		    }
		});

	// When click "add item" add new offer item
	$('body').on('click', '.b2bking_offer_add_item_button', function(){
		addNewOfferItem($(this));
	});

	var offerItemsCounter = 1;
	function addNewOfferItem(clickedButton){
	    // destroy select2
	    $('.b2bking_offer_product_selector').select2();
	    $('.b2bking_offer_product_selector').select2('destroy');

	    let currentItem = offerItemsCounter;
	    let nextItem = currentItem+1;
	    offerItemsCounter++;
	    
	    // Find the parent row of the clicked button
	    let parentRow = clickedButton.closest('[id^="b2bking_offer_number_"]');
	    
	    // Clone the first row and insert it after the clicked button's row
	    $('#b2bking_offer_number_1').clone().attr('id', 'b2bking_offer_number_'+nextItem).insertAfter(parentRow);
	    
	    // clear values from clone
	    $('#b2bking_offer_number_'+nextItem+' .b2bking_offer_text_input').val('');
	    $('#b2bking_offer_number_'+nextItem+' .b2bking_offer_product_selector').val('').trigger('change');
	    // remove delete if it exists
	    $('#b2bking_offer_number_'+nextItem+' .b2bking_offer_delete_item_button').remove();
	    
	    $('#b2bking_offer_number_'+nextItem+' .b2bking_item_subtotal').text(salesking_display_settings.currency_symbol+'0');
	    // add delete button to new item
	    $('<button type="button" class="secondary-button button b2bking_offer_delete_item_button btn btn-secondary">'+salesking_display_settings.text_delete+'</button>').insertAfter('#b2bking_offer_number_'+nextItem+' .b2bking_offer_add_item_button');
	    
	    //reinitialize select2
	    $('.b2bking_offer_product_selector').select2();
	}

		// On click "delete"
		$('body').on('click', '.b2bking_offer_delete_item_button', function(){
		    $(this).parent().parent().remove();
		    offerCalculateTotals();
		    offerSetHiddenField();
		});

		// On quantity or price change, calculate totals
		$('body').on('input', '.b2bking_offer_item_quantity, .b2bking_offer_item_name, .b2bking_offer_item_price', function(){
		    offerCalculateTotals();
		    offerSetHiddenField();
		});
		
		function offerCalculateTotals(){
		    let total = 0;
		    // foreach item calculate subtotal
		    $('.b2bking_offer_item_quantity').each(function(){
		        let quantity = $(this).val();
		        let price = $(this).parent().parent().find('.b2bking_offer_item_price').val();
		        if (quantity !== undefined && price !== undefined){
		            // set subtotal
		            total+=price*quantity;
		            $(this).parent().parent().find('.b2bking_item_subtotal').text(salesking_display_settings.currency_symbol+Number((price*quantity).toFixed(4)));
		        }
		    });

		    // finished, add up subtotals to get total
		    $('#b2bking_offer_total_text_number').text(salesking_display_settings.currency_symbol+Number((total).toFixed(4)));
		}

		function offerSetHiddenField(){
		    let field = '';
		    // clear textarea
		    $('#b2bking_admin_offer_textarea').val('');
		    // go through all items and list them IF they have PRICE AND QUANTITY
		    $('.b2bking_offer_item_quantity').each(function(){
		        let quantity = $(this).val();
		        let price = $(this).parent().parent().find('.b2bking_offer_item_price').val();
		        if (quantity !== undefined && price !== undefined && quantity !== null && price !== null && quantity !== '' && price !== ''){
		            // Add it to string
		            let name = $(this).parent().parent().find('.b2bking_offer_item_name').val();
		            if (name === undefined || name === ''){
		                name = '(no title)';
		            }
		            field+= name+';'+quantity+';'+price+'|';
		        }
		    });

		    // at the end, remove last character
		    field = field.substring(0, field.length - 1);
		    $('#b2bking_admin_offer_textarea').val(field);
		}

		function offerRetrieveHiddenField(){
		    // get field;
		    let field = $('#b2bking_admin_offer_textarea').val();
		    let itemsArray = field.split('|');
		    // foreach condition, add condition, add new item
		    itemsArray.forEach(function(item){
		        let itemDetails = item.split(';');
		        if (itemDetails[0] !== undefined && itemDetails[0] !== ''){
		            $('#b2bking_offer_number_'+offerItemsCounter+' .b2bking_offer_item_name').val(itemDetails[0]);
		            $('#b2bking_offer_number_'+offerItemsCounter+' .b2bking_offer_item_quantity').val(itemDetails[1]);
		            $('#b2bking_offer_number_'+offerItemsCounter+' .b2bking_offer_item_price').val(itemDetails[2]);
		            // For this function, we want to add after the last item, so we pass the last add button
		            let lastAddButton = $('#b2bking_offer_number_'+offerItemsCounter+' .b2bking_offer_add_item_button');
		            addNewOfferItem(lastAddButton);
		        }
		    });
		    // at the end, remove the last Item added
		    if (offerItemsCounter > 1){
		        $('#b2bking_offer_number_'+offerItemsCounter).remove();
		    }

		}
		// OFFERS INTEGRATION END

		if (parseInt(salesking_display_settings.ajax_customers_table) === 0){
			var oTable = $('#salesking_dashboard_customers_table').DataTable({
				"language": {
				    "url": salesking_display_settings.datatables_folder+salesking_display_settings.tables_language_option+'.json'
				},
				oLanguage: {
	                sSearch: ""
	            },
	            stateSave: true,
	            dom: 'Bfrtip',
	            buttons: {
	                buttons: [
	                    { extend: 'csvHtml5', className: buttonclass, text: '↓ CSV', exportOptions: { columns: ":visible" } },
	                    { extend: 'pdfHtml5', className: buttonclass, text: '↓ PDF', exportOptions: { columns: ":visible" }, customize: function(doc) {
			              doc.defaultStyle.font = salesking_display_settings.pdf_download_font;
			          } },
	                    { extend: 'print', className: buttonclass, text: salesking_display_settings.print, exportOptions: { columns: ":visible" } },
	                    { extend: 'colvis', className: buttonclass, text: salesking_display_settings.edit_columns },
	                ]
	            }
			});
		} else {
			var oTable = $('#salesking_dashboard_customers_table').DataTable({
				"language": {
				    "url": salesking_display_settings.datatables_folder+salesking_display_settings.tables_language_option+'.json'
				},
				oLanguage: {
	                sSearch: ""
	            },
	            stateSave: true,
	            dom: 'Bfrtip',
	            buttons: {
	                buttons: [
	                    { extend: 'csvHtml5', className: buttonclass, text: '↓ CSV', exportOptions: { columns: ":visible" } },
	                    { extend: 'pdfHtml5', className: buttonclass, text: '↓ PDF', exportOptions: { columns: ":visible" }, customize: function(doc) {
			              doc.defaultStyle.font = salesking_display_settings.pdf_download_font;
			          } },
	                    { extend: 'print', className: buttonclass, text: salesking_display_settings.print, exportOptions: { columns: ":visible" } },
	                    { extend: 'colvis', className: buttonclass, text: salesking_display_settings.edit_columns },
	                ]
	            },
       			"processing": true,
       			"serverSide": true,
       			"info": false,
       		    "ajax": {
       		   		"url": salesking_display_settings.ajaxurl,
       		   		"type": "POST",
       		   		"data":{
       		   			action: 'salesking_customers_table_ajax',
       		   			security: salesking_display_settings.security,
       		   		}
       		   	},
       		   	createdRow: function( row, data, dataIndex ) {
   		   	        // Set the data-status attribute, and add a class
   		   	        $( row ).addClass('nk-tb-item');
   		   	        $( row ).find('td').addClass('nk-tb-col');
   		   	        $( row ).find('td:eq(0)').addClass('salesking-column-large');
   		   	        
   		   	    }
			});
		}
	

		$('#salesking_customers_search').keyup(function(){
		      oTable.search($(this).val()).draw() ;
		});

		// Teams table
		var aoTable = $('#salesking_dashboard_teams_table').DataTable({
			"language": {
			    "url": salesking_display_settings.datatables_folder+salesking_display_settings.tables_language_option+'.json'
			},
			oLanguage: {
                sSearch: ""
            },
            dom: 'Bfrtip',
            stateSave: true,
            buttons: {
                buttons: [
                    { extend: 'csvHtml5', className: buttonclass, text: '↓ CSV', exportOptions: { columns: ":visible" } },
                    { extend: 'pdfHtml5', className: buttonclass, text: '↓ PDF', exportOptions: { columns: ":visible" }, customize: function(doc) {
			              doc.defaultStyle.font = salesking_display_settings.pdf_download_font;
			          } },
                    { extend: 'print', className: buttonclass, text: salesking_display_settings.print, exportOptions: { columns: ":visible" } },
                    { extend: 'colvis', className: buttonclass, text: salesking_display_settings.edit_columns },
                ]
            }
		});

		$('#salesking_teams_search').keyup(function(){
		      aoTable.search($(this).val()).draw() ;
		});


		// Orders datatable
		if (parseInt(salesking_display_settings.ajax_orders_table) === 0){
		    $('#salesking_dashboard_orders_table tfoot tr:eq(0) th').each( function (i) {
		        var title = $(this).text();
		        $(this).html( '<input type="text" class="salesking_search_column" placeholder="'+salesking_display_settings.searchtext+title+'..." />' );
		 
		        $( 'input', this ).on( 'keyup change', function () {
		            if ( abbtable.column(i).search() !== this.value ) {
		                abbtable
		                    .column(i)
		                    .search( this.value )
		                    .draw();
		            }
		        } );
		    } );

			 
			var abbtable = $('#salesking_dashboard_orders_table').DataTable({
				"language": {
				    "url": salesking_display_settings.datatables_folder+salesking_display_settings.tables_language_option+'.json'
				},
				oLanguage: {
	                sSearch: ""
	            },
	            dom: 'Bfrtip',
	            order: [[ 0, "desc" ]],
	            stateSave: true,
	            buttons: {
	                buttons: [
	                    { extend: 'csvHtml5', className: buttonclass, text: '↓ CSV', exportOptions: { columns: ":visible" } },
	                    { extend: 'pdfHtml5', className: buttonclass, text: '↓ PDF', exportOptions: { columns: ":visible" }, customize: function(doc) {
			              doc.defaultStyle.font = salesking_display_settings.pdf_download_font;
			          } },
	                    { extend: 'print', className: buttonclass, text: salesking_display_settings.print, exportOptions: { columns: ":visible" } },
	                    { extend: 'colvis', className: buttonclass, text: salesking_display_settings.edit_columns },
	                ]
	            }

			});
		} else {
			var abbtable = $('#salesking_dashboard_orders_table').DataTable({
				"language": {
				    "url": salesking_display_settings.datatables_folder+salesking_display_settings.tables_language_option+'.json'
				},
				oLanguage: {
	                sSearch: ""
	            },
	            dom: 'Bfrtip',
	            stateSave: true,
	            order: [[ 0, "desc" ]],
	            buttons: {
	                buttons: [
	                    { extend: 'csvHtml5', className: buttonclass, text: '↓ CSV', exportOptions: { columns: ":visible" } },
	                    { extend: 'pdfHtml5', className: buttonclass, text: '↓ PDF', exportOptions: { columns: ":visible" }, customize: function(doc) {
			              doc.defaultStyle.font = salesking_display_settings.pdf_download_font;
			          } },
	                    { extend: 'print', className: buttonclass, text: salesking_display_settings.print, exportOptions: { columns: ":visible" } },
	                    { extend: 'colvis', className: buttonclass, text: salesking_display_settings.edit_columns },
	                ]
	            },
	            "processing": true,
       			"serverSide": true,
       			"info": false,
       		    "ajax": {
       		   		"url": salesking_display_settings.ajaxurl,
       		   		"type": "POST",
       		   		"data":{
       		   			action: 'salesking_orders_table_ajax',
       		   			security: salesking_display_settings.security,
       		   		}
       		   	},
       		   	createdRow: function( row, data, dataIndex ) {
   		   	        // Set the data-status attribute, and add a class
   		   	        $( row ).addClass('nk-tb-item');
   		   	        $( row ).find('td').addClass('nk-tb-col');
   		   	        $( row ).find('td:eq(0)').addClass('salesking-column-large');
   		   	    }

			});
		}

		$('#salesking_orders_search').keyup(function(){
		      abbtable.search($(this).val()).draw() ;
		});

		$('#salesking_orders_search').trigger('keyup');

		// Earnings datatable
	    $('#salesking_dashboard_earnings_table tfoot tr:eq(0) th').each( function (i) {
	        var title = $(this).text();
	        $(this).html( '<input type="text" class="salesking_search_column" placeholder="'+salesking_display_settings.searchtext+title+'..." />' );
	 
	        $( 'input', this ).on( 'keyup change', function () {
	            if ( table.column(i).search() !== this.value ) {
	                table
	                    .column(i)
	                    .search( this.value )
	                    .draw();
	            }
	        } );
	    } );

		 
		var table = $('#salesking_dashboard_earnings_table').DataTable({
			"language": {
			    "url": salesking_display_settings.datatables_folder+salesking_display_settings.tables_language_option+'.json'
			},
			oLanguage: {
                sSearch: ""
            },
            dom: 'Bfrtip',
            stateSave: true,
            order: [[ 0, "desc" ]],
            buttons: {
                buttons: [
                    { extend: 'csvHtml5', className: buttonclass, text: '↓ CSV', exportOptions: { columns: ":visible" } },
                    { extend: 'pdfHtml5', className: buttonclass, text: '↓ PDF', exportOptions: { columns: ":visible" }, customize: function(doc) {
			              doc.defaultStyle.font = salesking_display_settings.pdf_download_font;
			          }},
                    { extend: 'print', className: buttonclass, text: salesking_display_settings.print, exportOptions: { columns: ":visible" } },
                    { extend: 'colvis', className: buttonclass, text: salesking_display_settings.edit_columns },
                ]
            }
		});


		$('#salesking_earnings_search').keyup(function(){
		      table.search($(this).val()).draw() ;
		});

		// Subagents arnings datatable
	    $('#salesking_dashboard_subagents_earnings_table tfoot tr:eq(0) th').each( function (i) {
	        var title = $(this).text();
	        $(this).html( '<input type="text" class="salesking_search_column" placeholder="'+salesking_display_settings.searchtext+title+'..." />' );
	 
	        $( 'input', this ).on( 'keyup change', function () {
	            if ( actable.column(i).search() !== this.value ) {
	                actable
	                    .column(i)
	                    .search( this.value )
	                    .draw();
	            }
	        } );
	    } );

		 
		var actable = $('#salesking_dashboard_subagents_earnings_table').DataTable({
			"language": {
			    "url": salesking_display_settings.datatables_folder+salesking_display_settings.tables_language_option+'.json'
			},
			oLanguage: {
                sSearch: ""
            },
            dom: 'Bfrtip',
            stateSave: true,
            order: [[ 0, "desc" ]],
            buttons: {
                buttons: [
                    { extend: 'csvHtml5', className: buttonclass, text: '↓ CSV', exportOptions: { columns: ":visible" } },
                    { extend: 'pdfHtml5', className: buttonclass, text: '↓ PDF', exportOptions: { columns: ":visible" }, customize: function(doc) {
			              doc.defaultStyle.font = salesking_display_settings.pdf_download_font;
			          } },
                    { extend: 'print', className: buttonclass, text: salesking_display_settings.print, exportOptions: { columns: ":visible" } },
                    { extend: 'colvis', className: buttonclass, text: salesking_display_settings.edit_columns },
                ]
            }
		});


		$('#salesking_subagents_earnings_search').keyup(function(){
		      actable.search($(this).val()).draw() ;
		});



		// On clicking Save coupon
		$('#salesking_dashboard_save_coupon').on('click', function(e){

			// check that coupon is valid
			if ($('#salesking_coupon_submit_form')[0].checkValidity()){
				// Run ajax request
				var datavar = {
		            action: 'saleskingsavecoupon',
		            security: salesking_display_settings.security,
		            couponcode: $('#salesking_coupon_code_input').val(),
		            expirydate: $('#salesking_expiry_date_input').val(),
		            minspend: $('#salesking_minimum_spend_input').val(),
		            maxspend: $('#salesking_maximum_spend_input').val(),
		            discount: $('#salesking_discount_input').val(),
		            limit: $('#salesking_limit_input').val(),	
		            exclude: $('#salesking_exclude_sales_items').is(":checked"),	
		            allowfree: $('#salesking_allow_free_shipping').is(":checked"),	
		        };

				$.post(salesking_display_settings.ajaxurl, datavar, function(response){
					alert(salesking_display_settings.coupon_created);
					window.location.reload();
				});
			} else {
				$('#salesking_coupon_submit_form')[0].reportValidity();
			}
			
		});


		$('.salesking_delete_coupon').on('click', function(){
			// Run ajax request
			if (confirm(salesking_display_settings.sure_delete_coupon)){
				var datavar = {
		            action: 'saleskingdeletecoupon',
		            security: salesking_display_settings.security,
		            couponpostid: $(this).val(),
		        };
		        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
		        	window.location.reload();
		        });
		    }
		});

		$('#salesking_registration_link_button').on('click', function(){
			var copyText = document.getElementById("salesking_registration_link");
			copyText.select();
			copyText.setSelectionRange(0, 99999); /* For mobile devices */

			/* Copy the text inside the text field */
			document.execCommand("copy");
			$('#salesking_registration_link_button').text(salesking_display_settings.copied);
			setTimeout(function(){
				$('#salesking_registration_link_button').text(salesking_display_settings.copy);
			}, 900);
		});

		$('#salesking_shopping_link_button').on('click', function(){
			var copyText = document.getElementById("salesking_shopping_link");
			copyText.select();
			copyText.setSelectionRange(0, 99999); /* For mobile devices */

			/* Copy the text inside the text field */
			document.execCommand("copy");
			$('#salesking_shopping_link_button').text(salesking_display_settings.copied);
			setTimeout(function(){
				$('#salesking_shopping_link_button').text(salesking_display_settings.copy);
			}, 900);
		});


		$('#salesking_generator_link_button').on('click', function(){

			var link = $('#salesking_generator_link').val();
			// add affiliate
			var affiliate = $('#salesking_shopping_link').val();
			affiliate = '?'+affiliate.split('?')[1];
			link = link+affiliate;

			$('#salesking_generator_link').val(link);

			var copyText = document.getElementById("salesking_generator_link");
			copyText.select();
			copyText.setSelectionRange(0, 99999); /* For mobile devices */

			/* Copy the text inside the text field */
			document.execCommand("copy");

			$('#salesking_generator_link_button').text(salesking_display_settings.ready);
			$('#salesking_generator_link_button').prop('disabled', true);
			$('#salesking_generator_link').prop('readonly', true);
			$('.tooltip-inner').text(salesking_display_settings.link_copied);
			setTimeout(function(){
				$('.tooltip-inner').remove();
			}, 600);
		});

		$('#salesking_create_cart_button').on('click', function(){

			var cartname = $('#salesking_create_cart_name').val();

			// Run ajax request
			if (confirm(salesking_display_settings.sure_create_cart)){
				var datavar = {
		            action: 'saleskingcreatecart',
		            security: salesking_display_settings.security,
		            name: cartname,
		        };

		        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
		        	window.location.reload();
		        });
		    }
		});

		$('.salesking_copy_cart_link').on('click', function(){

			var text = $(this).val();

			// Create a "hidden" input
			var aux = document.createElement("input");
			aux.setAttribute("value", text);
			document.body.appendChild(aux);
			aux.select();
			document.execCommand("copy");
			document.body.removeChild(aux);

			$(this).text(salesking_display_settings.copied);
			var thisbutton = $(this);
			setTimeout(function(){
				$(thisbutton).text(salesking_display_settings.copy_link);
			}, 1000);

		});

		$('.salesking_delete_cart_link').on('click', function(){
			var cartname = $(this).val();
			// Run ajax request
			if (confirm(salesking_display_settings.sure_delete_cart)){
				var datavar = {
		            action: 'saleskingdeletecart',
		            security: salesking_display_settings.security,
		            name: cartname,
		        };

		        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
		        	window.location.reload();
		        });
		    }
		});

		$('#salesking_add_customer').on('click', function(){	

			if ($('#salesking_add_customer_form')[0].checkValidity()){

				if (confirm(salesking_display_settings.sure_add_customer)){
					var datavar = {
			            action: 'saleskingaddcustomer',
			            security: salesking_display_settings.security,
			            firstname: $('#first-name').val(),
			            lastname: $('#last-name').val(),
			            companyname: $('#company-name').val(),
			            country: $('#billing_country').val(),
			            state: $('#billing_state').val(),
			            streetaddress: $('#street-address').val(),
			            streetaddress2: $('#street-address2').val(),
			            towncity: $('#town-city').val(),
			            county: $('#county').val(),
			            postcodezip: $('#postcode-zip').val(),
			            phoneno: $('#phone-no').val(),
			            username: $('#username').val(),
			            emailaddress: $('#email-address').val(),
			            password: $('#password').val(),
			            b2bkinggroup: $('#salesking_b2bking_group').val(),
			            b2bwhsgroup: $('#salesking_b2bwhs_group').val(),
			        };

			        // add custom fields via snippets
			        var custom_fields_code = $('#salesking_custom_fields_code').val();
			        if (custom_fields_code !== ''){
			        	let fields_array = custom_fields_code.split(',');
			        	$.each(fields_array, function (index, i) {
			        		datavar[i] = jQuery('#salesking_field_'+i).val();
			        	});
			        }

			        // add custom fields
			        let custom_fields = $('#salesking_b2bking_custom_fields').val();

			        if ($('#salesking_b2bking_custom_fields').val() === undefined || $('#salesking_b2bking_custom_fields').val() === ''){
			        	custom_fields = $('#salesking_b2bwhs_custom_fields').val();
			        }

			        if (custom_fields !== undefined){
				        let fields_array = custom_fields.split(',');

				        $.each(fields_array, function (index, i) {
				        	datavar[i] = jQuery('#salesking_field_'+i).val();
				        });
				    } else {
				    	custom_fields = '';
				    }

			        datavar.customfields = custom_fields;

			        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
			        	if (response.startsWith('error')){
			        		alert(salesking_display_settings.customer_created_error+' '+response);
			        		console.log(response);
			        	} else {
			        		alert(salesking_display_settings.customer_created);
			        		window.location.reload();
			        		setTimeout(function(){
			        			window.location.reload();
			        		}, 250);
			        	}
			        });
			    }
			} else {
				$('#salesking_add_customer_form')[0].reportValidity();
			}

		});

		// add subagent
		$('#salesking_add_subagent').on('click', function(){	

			if ($('#salesking_add_subagent_form')[0].checkValidity()){

				if (confirm(salesking_display_settings.sure_add_subagent)){
					var datavar = {
			            action: 'saleskingaddsubagent',
			            security: salesking_display_settings.security,
			            firstname: $('#first-name').val(),
			            lastname: $('#last-name').val(),
			            phoneno: $('#phone-no').val(),
			            username: $('#username').val(),
			            emailaddress: $('#email-address').val(),
			            password: $('#password').val(),

			        };

			        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
			        	if (response.startsWith('error')){
			        		alert(salesking_display_settings.subagent_created_error+' '+response);
			        		console.log(response);
			        	} else {
			        		alert(salesking_display_settings.subagent_created);
			        		window.location.reload();
			        	}
			        	
			        });
			    }
			} else {
				$('#salesking_add_subagent_form')[0].reportValidity();
			}

		});

		// when clicking shop as customer
		$('body').on('click', '.salesking_shop_as_customer', function(){
			var customerid = $(this).val();
			var datavar = {
	            action: 'saleskingshopascustomer',
	            security: salesking_display_settings.security,
	            customer: customerid,
	        };

	        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
	        	window.location = salesking_display_settings.shopurl;
	        });
		});

		// when clicking EDIT shop as customer
		$('body').on('click', '.salesking_shop_as_customer_edit', function(){
			var customerid = $(this).val();
			var datavar = {
	            action: 'saleskingshopascustomer',
	            security: salesking_display_settings.security,
	            customer: customerid,
	        };

	        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
	        	window.location = salesking_display_settings.accounturl;
	        });
		});

		$('#salesking_return_agent').on('click', function(){
			var agentid = $(this).val();
			var agentregistered = $('#salesking_return_agent_registered').val();

			var datavar = {
	            action: 'saleskingswitchtoagent',
	            security: salesking_display_settings.security,
	            agent: agentid,
	            agentdate: agentregistered,
	        };

	        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
	        	window.location = salesking_display_settings.customersurl;
	        });
		});

		/* Payouts */
		showhidepaymentmethods();

		$('input[type=radio][name="saleskingpayoutMethod"]').change(function() {
			showhidepaymentmethods();
		});

		function showhidepaymentmethods(){
			// first hide all methods

			$('.salesking_paypal_info, .salesking_bank_info, .salesking_custom_info').css('display', 'none');
			// Show which payment method the user chose
			let selectedValue = $('input[type=radio][name="saleskingpayoutMethod"]:checked').val();
			if (selectedValue === "paypal") {
				// show paypal
				$('.salesking_paypal_info').css('display', 'block');
			} else if (selectedValue === "bank"){
				$('.salesking_bank_info').css('display', 'block');
			} else if (selectedValue === "custom"){
				$('.salesking_custom_info').css('display', 'block');
			}
		}

		// save payout info
		$('#salesking_save_payout').on('click', function(){	
			if (confirm(salesking_display_settings.sure_save_info)){
				var datavar = {
		            action: 'saleskingsaveinfo',
		            security: salesking_display_settings.security,
		            chosenmethod: $('input[type=radio][name="saleskingpayoutMethod"]:checked').val(),
		            paypal: $('#paypal-email').val(),
		            custom: $('#custom-method').val(),
		            fullname: $('#full-name').val(),
		            billingaddress1: $('#billing-address-1').val(),
		            billingaddress2: $('#billing-address-2').val(),
		            city: $('#city').val(),
		            state: $('#state').val(),
		            postcode: $('#postcode').val(),
		            country: $('#country').val(),
		            bankholdername: $('#bank-account-holder-name').val(),
		            bankaccountnumber: $('#bank-account-number').val(),
		            branchcity: $('#bank-branch-city').val(),
		            branchcountry: $('#bank-branch-country').val(),
		            intermediarycode: $('#intermediary-bank-bank-code').val(),
		            intermediaryname: $('#intermediary-bank-name').val(),
		            intermediarycity: $('#intermediary-bank-city').val(),
		            intermediarycountry: $('#intermediary-bank-country').val(),
		        };


		        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
		        	window.location.reload();
		        });
		    }
		});

		// save user profile settings
		$('#salesking_save_settings').on('click', function(){	
			var datavar = {
	            action: 'salesking_save_profile_settings',
	            security: salesking_display_settings.security,
	            announcementsemails: $('#new-announcements').is(":checked"),
	            messagesemails: $('#new-messages').is(":checked"),
	            userid: $(this).val(),
	        };


	        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
	        	window.location.reload();
	        });

		});

		$('#salesking_update_profile').on('click', function(){	
			var datavar = {
	            action: 'salesking_save_profile_info',
	            security: salesking_display_settings.security,
	            firstname: $('#first-name').val(),
	            lastname: $('#last-name').val(),
	            displayname: $('#display-name').val(),
	            emailad: $('#email').val(),
	        };

	        $.post(salesking_display_settings.ajaxurl, datavar, function(response){
	        	window.location.reload();
	        });

		});

		// checkout registration
		if (parseInt(salesking_display_settings.ischeckout) === 1){
			showHideCheckout();
			$('#createaccount').change(showHideCheckout);
		}

		function showHideCheckout(){
			if($('#createaccount').prop('checked') || typeof $('#createaccount').prop('checked') === 'undefined') {
		    	$('input[name="salesking_registration_link"]').parent().css('display','block');
		    } else {      
		    	$('input[name="salesking_registration_link"]').parent().css('display','none');

		    }
		}	
		

	});

})(jQuery);
