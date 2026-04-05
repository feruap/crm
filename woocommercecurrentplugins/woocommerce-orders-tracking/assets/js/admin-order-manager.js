jQuery(document).ready(function ($) {
    'use strict';
    /**
     * @var vi_wot_admin_order_manager
     */
    let custom_carriers_list = JSON.parse(vi_wot_admin_order_manager.custom_carriers_list),
        active_carriers = vi_wot_admin_order_manager.active_carriers,
        paypal_enable = vi_wot_admin_order_manager.paypal_enable;
    $(document).on('click', '.woo-orders-tracking-tracking-service-copy', function () {
        let $temp = $('<input>');
        $('body').append($temp);
        let $container = $(this).closest('.woo-orders-tracking-tracking-number-container');
        let tracking_number = $container.data('tracking_number');
        $temp.val(tracking_number).select();
        document.execCommand('copy');
        $temp.remove();
        villatheme_admin_show_message(vi_wot_admin_order_manager.i18n_message_copy, 'success', tracking_number, false, 2000);
    });
    $(document).on('click', '.woo-orders-tracking-tracking-service-refresh-bulk', function (e) {
        let $button = $(this);
        let $container = $button.closest('.woo-orders-tracking-tracking-service-refresh-bulk-container');
        if (!$container.hasClass('woo-orders-tracking-tracking-service-refresh-bulk-container-loading')) {
            let $refresh_buttons = $('.woo-orders-tracking-tracking-service-refresh');
            if ($refresh_buttons.length > 0) {
                let count = 0;
                $refresh_buttons.map(function () {
                    let $refresh_button_container = $(this).closest('.woo-orders-tracking-tracking-number-container');
                    if (!$refresh_button_container.hasClass('woo-orders-tracking-tracking-number-container-loading') && !$refresh_button_container.hasClass('woo-orders-tracking-tracking-number-container-delivered')) {
                        count++;
                        $(this).trigger('click');
                    }
                });
                if (count > 0) {
                    $('.villatheme-admin-show-message-message-item-close').trigger('click')
                    $container.addClass('woo-orders-tracking-tracking-service-refresh-bulk-container-loading');
                }
            }
        }
    });
    $(document).on('click', '.woo-orders-tracking-tracking-service-refresh', function (e) {
        let $button = $(this);
        let $container = $button.closest('.woo-orders-tracking-tracking-number-container');
        if ($container.hasClass('woo-orders-tracking-tracking-number-container-loading')) {
            return;
        }
        $.ajax({
            url: vi_wot_admin_order_manager.ajax_url,
            type: 'POST',
            dataType: 'JSON',
            data: {
                action: 'vi_wot_refresh_track_info',
                tracking_number: $container.data('tracking_number'),
                carrier_slug: $container.data('carrier_slug'),
                order_id: $container.data('order_id'),
                action_nonce: $('#_vi_wot_item_nonce').val(),
            },
            beforeSend: function () {
                $container.addClass('woo-orders-tracking-tracking-number-container-loading');
            },
            success: function (response) {
                if (response.status === 'success') {
                    $button.attr('title', response.button_title);
                    if (response.tracking_container_class) {
                        $container.attr('class', response.tracking_container_class);
                    }
                    if (response.tracking_status) {
                        $container.attr('data-tooltip', response.tracking_status);
                    } else {
                        $container[0].removeAttribute('data-tooltip');
                    }
                    villatheme_admin_show_message(response.message, response.status, response.message_content, false, 5000);
                } else {
                    villatheme_admin_show_message(response.message, response.status, response.message_content);
                }
            },
            error: function (err) {
                villatheme_admin_show_message('Error', 'error', err.responseText.replace(/<\/?[^>]+(>|$)/g, ""));
            },
            complete: function () {
                $container.removeClass('woo-orders-tracking-tracking-number-container-loading');
                let $bulk_refresh = $('.woo-orders-tracking-tracking-service-refresh-bulk-container');
                if ($bulk_refresh.hasClass('woo-orders-tracking-tracking-service-refresh-bulk-container-loading') && $('.woo-orders-tracking-tracking-number-container-loading').length === 0) {
                    $bulk_refresh.removeClass('woo-orders-tracking-tracking-service-refresh-bulk-container-loading');
                }
            }
        });
    });
    $(document).on('click', '.woo-orders-tracking-tracking-number-column-container', function (e) {
        e.stopPropagation();
    });
    $(document).on('click', '.vi_wot_tracking_code .woo-orders-tracking-paypal-active', function () {
        let $button = $(this), order_id = $button.data('order_id'),
            $paypal_image = $button.find('.woo-orders-tracking-item-tracking-button-add-to-paypal'),
            $result_icon = $('<span class="woo-orders-tracking-paypal-result dashicons"></span>');
        $.ajax({
            url: vi_wot_admin_order_manager.ajax_url,
            type: 'POST',
            dataType: 'JSON',
            data: {
                action: 'vi_woo_orders_tracking_add_tracking_to_paypal',
                item_id: $button.data('item_id'),
                order_id: order_id,
                action_nonce: $('#_vi_wot_item_nonce').val(),
            },
            beforeSend: function () {
                $button.find('.woo-orders-tracking-paypal-result').remove();
                $button.removeClass('woo-orders-tracking-paypal-active').addClass('woo-orders-tracking-paypal-inactive');
                $paypal_image.attr('src', vi_wot_admin_order_manager.loading_image);
            },
            success: function (response) {
                if (response.status === 'success') {
                    $result_icon.addClass('dashicons-yes-alt').addClass('woo-orders-tracking-paypal-result-success');
                    $button.append($result_icon);
                    if (response.paypal_button_title) {
                        $paypal_image.attr('title', response.paypal_button_title);
                    }
                    $result_icon.attr('title', response.message).fadeOut(10000);
                } else {
                    $button.removeClass('woo-orders-tracking-paypal-inactive').addClass('woo-orders-tracking-paypal-active').append($result_icon);
                    villatheme_admin_show_message(vi_wot_admin_order_manager.i18n_error_paypal.replace('{tracking_number}', $button.closest('.woo-orders-tracking-tracking-number-container').data('tracking_number')).replace('{order_id}', order_id), 'error', response.message);
                }
            },
            error: function (err) {
                $result_icon.addClass('dashicons-no-alt').addClass('woo-orders-tracking-paypal-result-error');
                $button.removeClass('woo-orders-tracking-paypal-inactive').addClass('woo-orders-tracking-paypal-active').append($result_icon);
                $button.append($result_icon);
            },
            complete: function () {
                $paypal_image.attr('src', vi_wot_admin_order_manager.paypal_image)
            }
        });
    });
    /*Send tracking email*/
    $(document).on('click', '.woo-orders-tracking-send-tracking-email', function () {
        let $button = $(this);
        let $container = $button.closest('.woo-orders-tracking-send-tracking-email-container');
        if (!$button.hasClass('woo-orders-tracking-loading')) {
            let $result_icon = $('<span class="woo-orders-tracking-result-icon dashicons"></span>');
            $.ajax({
                url: vi_wot_admin_order_manager.ajax_url,
                type: 'POST',
                dataType: 'JSON',
                data: {
                    action: 'vi_woo_orders_tracking_send_tracking_email',
                    order_id: $button.data('order_id'),
                    action_nonce: $('#_vi_wot_item_nonce').val(),
                },
                beforeSend: function () {
                    $container.find('.woo-orders-tracking-result-icon').remove();
                    $button.addClass('woo-orders-tracking-loading');
                },
                success: function (response) {
                    let time_out = 0;
                    if (response.status === 'success') {
                        time_out = 3000;
                        $result_icon.addClass('dashicons-yes-alt').addClass('woo-orders-tracking-result-success');
                        $container.append($result_icon);
                    } else {
                        $result_icon.addClass('dashicons-no-alt').addClass('woo-orders-tracking-result-error');
                        $container.append($result_icon);
                    }
                    if (response.message) {
                        villatheme_admin_show_message(response.message, response.status, '', false, time_out);
                    }
                },
                error: function (err) {
                    $result_icon.addClass('dashicons-no-alt').addClass('woo-orders-tracking-result-error');
                    $container.append($result_icon);
                    villatheme_admin_show_message('Unknown error occurs', 'error', '', false);
                },
                complete: function () {
                    $button.removeClass('woo-orders-tracking-loading');
                }
            })
        }
    });
    $(document).on('click', '.woo-orders-tracking-order-tracking-info-overlay', function (e) {
        e.stopPropagation();
    });
    $(document).on('click', '.woo-orders-tracking-order-tracking-info-icon', function (e) {
        e.stopPropagation();
        let data = $(this).data();
        let $icon = $('.woo-orders-tracking-order-tracking-info-wrap-' + data['order_id']);
        if ($icon.hasClass('woo-orders-tracking-order-tracking-info-hidden')) {
            $(this).addClass('woo-orders-tracking-order-tracking-info-open');
            $icon.removeClass('woo-orders-tracking-order-tracking-info-hidden');
        } else {
            $(this).removeClass('woo-orders-tracking-order-tracking-info-open');
            $icon.addClass('woo-orders-tracking-order-tracking-info-hidden');
        }
    });

    $(document).on('click', '.woo-orders-tracking-order-tracking-info-wrap', function (e) {
        e.stopPropagation();
    });

    /**
     * As active carriers are dynamic and it may not contain the carrier of a specific tracking number created before, this function should be called whenever implementing a carrier selection dropdown
     * @param carrier_slug
     * @returns {string}
     */
    function get_shipping_carriers_html(carrier_slug) {
        let shipping_carriers_define_list,
            carriers,
            html = '';
        shipping_carriers_define_list = JSON.parse(vi_wot_admin_order_manager.shipping_carriers_define_list);
        carriers = shipping_carriers_define_list.concat(custom_carriers_list);
        let temp_active_carriers = active_carriers.concat();
        if (carrier_slug && temp_active_carriers.indexOf(carrier_slug) < 0) {
            temp_active_carriers.push(carrier_slug);
        }
        if (carriers.length > 0) {
            carriers = wot_sort_carriers(carriers);
            if (temp_active_carriers.length > 0) {
                for (let i = 0; i < carriers.length; i++) {
                    if (temp_active_carriers.indexOf(carriers[i].slug) > -1) {
                        let display_name = carriers[i]?.display_name ? (carriers[i].name + '( '+carriers[i]?.display_name + ')') :carriers[i].name;
                        html += '<option value="' + carriers[i].slug + '">' + display_name + '</option>';
                    }
                }
            } else {
                for (let i = 0; i < carriers.length; i++) {
                    let display_name = carriers[i]?.display_name ? (carriers[i].name + '( '+carriers[i]?.display_name + ')') :carriers[i].name;
                    html += '<option value="' + carriers[i].slug + '">' + display_name + '</option>';
                }
            }
        }
        return html;
    }

    let $popup = $('.woo-orders-tracking-edit-tracking-container');
    /*Build the quick order selection in the popup*/
    let $orders_select = $popup.find('.woo-orders-tracking-edit-tracking-content-header-order-select');
    $('.woo-orders-tracking-edit-order-tracking').map(function () {
        let $button = $(this), order_id = $button.data('order_id'),
            order_number = $button.closest('tr').find('td.order_number .order-view').html();
        $orders_select.append(`<option value="${order_id}">${order_number}</option>`);
    });
    $orders_select.on('change', function () {
        let current_order_id = $popup.find('.woo-orders-tracking-edit-tracking-button-save-all').data('order_id');
        if (current_order_id && current_order_id != $(this).val()) {
            $(`.woo-orders-tracking-edit-order-tracking[data-order_id="${$(this).val()}"]`).trigger('click');
        }
    });
    let focus_item = {item_id: false, quantity_index: ''};
    /**
     * Open popup to edit/add tracking data of all items
     */
    $(document).on('click', '.woo-orders-tracking-edit-order-tracking', function () {
        let $button = $(this),
            $save_button = $popup.find('.woo-orders-tracking-edit-tracking-button-save-all'),
            $tracking_content = $popup.find('.woo-orders-tracking-edit-tracking-content-body-row-details'),
            button_data = $button.data(),
            order_id = $button.data('order_id'),
            $order_tracking_container = $button.closest('.woo-orders-tracking-tracking-number-column-container');
        for (let i in button_data) {
            if (button_data.hasOwnProperty(i)) {
                $save_button.data(i, button_data[i]);//must use before trigger change of $orders_select to avoid an infinite loop
            }
        }
        $orders_select.val(order_id).trigger('change');
        if ($button.data('sms_available')) {
            $popup.find('.woo-orders-tracking-edit-tracking-send-sms-container').removeClass('woo-orders-tracking-hidden');
        } else {
            $popup.find('.woo-orders-tracking-edit-tracking-send-sms-container').addClass('woo-orders-tracking-hidden');
        }
        $tracking_content.html('');
        let order_tracking_data = [];
        $order_tracking_container.find('.woo-orders-tracking-tracking-number-container').map(function () {
            let tracking_data = $(this).data();
            let item_sku = tracking_data['item_sku'] ? `<div class="woo-orders-tracking-edit-tracking-content-body-row-details-item-sku"><strong>${vi_wot_admin_order_manager.i18n_sku}</strong> ${tracking_data['item_sku']}</div>` : '';
            let item_column;
            if (tracking_data['item_id']) {
                item_column = `<td class="woo-orders-tracking-edit-tracking-content-body-row-item-id-col">${tracking_data['item_id']}</td><td class="woo-orders-tracking-edit-tracking-content-body-row-item-detail-col" title="${tracking_data['item_name']}"><div class="woo-orders-tracking-edit-tracking-content-body-row-details-item-name">${tracking_data['item_name']}</div>${item_sku}</td>`;
            } else {
                item_column = `<td colspan="2"><strong>${vi_wot_admin_order_manager.i18n_order_row}</strong></td>`;
            }
            let paypal_checkbox;
            switch (tracking_data['paypal_status'].toString()) {
                case '1':
                    paypal_checkbox = '<input class="wot-admin-orders-item-paypal" type="checkbox" value="1">';
                    break;
                case '2':
                    paypal_checkbox = '<input class="wot-admin-orders-item-paypal" type="checkbox" value="1" checked disabled>';
                    break;
                default:
                    paypal_checkbox = '<input class="wot-admin-orders-item-paypal" type="checkbox" value="1" disabled>';
            }
            let $new_row = $(`<tr>${item_column}<td><input class="wot-admin-orders-item-tracking-number" type="text" value="${tracking_data['tracking_number']}"></td><td><select class="wot-admin-orders-item-tracking-carrier"></select></td><td class="woo-orders-tracking-edit-tracking-content-body-row-paypal-col">${paypal_checkbox}</td></tr>`);
            for (let i in tracking_data) {
                if (tracking_data.hasOwnProperty(i)) {
                    $new_row.data(i, tracking_data[i]);
                }
            }
            let $select_carrier = $new_row.find('.wot-admin-orders-item-tracking-carrier');
            $select_carrier.html(get_shipping_carriers_html(tracking_data['carrier_slug']));
            $select_carrier.select2({
                dropdownParent: $popup
            });
            $tracking_content.append($new_row);
            if (tracking_data['carrier_slug']) {
                $select_carrier.val(tracking_data['carrier_slug']).trigger('change');
            } else {
                $select_carrier.val(vi_wot_admin_order_manager.shipping_carrier_default).trigger('change');
            }
            order_tracking_data.push(tracking_data);
        });
        let only_tracking_of_order = false;
        if (order_tracking_data.length === 1 && order_tracking_data[0].item_id === '') {
            only_tracking_of_order = true;
        }
        for (let i = 0; i < order_tracking_data.length; i++) {
            if (order_tracking_data[i]['quantity_index'] === 1) {
                let rowspan = 0;
                for (let j = i + 1; j < order_tracking_data.length; j++) {
                    if (order_tracking_data[j]['quantity_index'] === 1) {
                        break;
                    } else {
                        rowspan++;
                        $tracking_content.find('>tr').eq(j).find('.woo-orders-tracking-edit-tracking-content-body-row-item-id-col').html(order_tracking_data[j]['item_id'] + `(${order_tracking_data[j]['quantity_index']})`);

                        // $tracking_content.find('>tr').eq(j).find('.woo-orders-tracking-edit-tracking-content-body-row-item-id-col').addClass('woo-orders-tracking-hidden');
                        // $tracking_content.find('>tr').eq(j).find('.woo-orders-tracking-edit-tracking-content-body-row-item-detail-col').addClass('woo-orders-tracking-hidden');
                    }
                }
                if (rowspan > 0) {
                    $tracking_content.find('>tr').eq(i).find('.woo-orders-tracking-edit-tracking-content-body-row-item-id-col').html(order_tracking_data[i]['item_id'] + '(1)');

                    // $tracking_content.find('>tr').eq(i).find('.woo-orders-tracking-edit-tracking-content-body-row-item-id-col').attr('rowspan', rowspan+1);
                    // $tracking_content.find('>tr').eq(i).find('.woo-orders-tracking-edit-tracking-content-body-row-item-detail-col').attr('rowspan', rowspan+1);
                }
            }
        }
        if (only_tracking_of_order) {
            focus_item.item_id = false;
            focus_item.quantity_index = '';
        }
        setTimeout(function () {
            let $tracking_numbers = $tracking_content.find('.wot-admin-orders-item-tracking-number');
            if ($tracking_numbers.length === 1) {
                focus_item.item_id = false;
                focus_item.quantity_index = '';
            }
            /*Focus to a specific tracking number if set, otherwise focus on the first(empty) tracking number*/
            if (focus_item.item_id !== false) {
                if (focus_item.item_id) {
                    for (let i = 0; i < $tracking_numbers.length; i++) {
                        let $tr = $tracking_numbers.eq(i).closest('tr');
                        if ($tr.data('item_id') == focus_item.item_id && $tr.data('quantity_index') === focus_item.quantity_index) {
                            $tracking_numbers.eq(i).focus();
                            $tracking_numbers.eq(i).closest('tr').addClass('woo-orders-tracking-edit-tracking-content-body-row-item-focus');
                            break;
                        }
                    }
                } else {
                    $tracking_numbers.eq(0).focus();
                    $tracking_numbers.eq(0).closest('tr').addClass('woo-orders-tracking-edit-tracking-content-body-row-item-focus');
                }
                focus_item.item_id = false;
                focus_item.quantity_index = '';
            } else {
                let $empty_tracking = $tracking_content.find('.wot-admin-orders-item-tracking-number[value=""]');
                if ($empty_tracking.length > 0) {
                    $empty_tracking.eq(0).focus();
                } else {
                    $tracking_numbers.eq(0).focus();
                }
            }
        }, 100);
        let $paypal_h = $popup.find('.woo-orders-tracking-edit-tracking-content-body-row-paypal-col'),
            $paypal_bulk = $paypal_h.find('.woo-orders-tracking-edit-tracking-content-body-row-paypal-bulk');
        if ($button.data('paypal_available')) {
            $paypal_h.removeClass('woo-orders-tracking-hidden');
        } else {
            $paypal_h.addClass('woo-orders-tracking-hidden');
        }
        if (paypal_enable){
            $paypal_bulk.prop('checked', true);
        }
        $paypal_bulk.trigger('change');
        if ($popup.hasClass('woo-orders-tracking-hidden')) {
            $popup.removeClass('woo-orders-tracking-hidden');
            disable_scroll();
        }
    });
    $(document).on('change', '.woo-orders-tracking-edit-tracking-content-body-row-paypal-bulk', function () {
        let $button = $(this),
            $paypal_checkbox = $button.closest('.woo-orders-tracking-edit-tracking-content-body').find('.wot-admin-orders-item-paypal');
        $paypal_checkbox.map(function () {
            if (!$(this).prop('disabled')) {
                $(this).prop('checked', $button.prop('checked'))
            }
        })
    });
    /**
     * Save tracking data
     * Refresh tracking number column/order status column if changed
     */
    $(document).on('click', '.woo-orders-tracking-edit-tracking-button-save-all', function () {
        let $button = $(this),
            order_id = $button.data('order_id'),
            order_status = $button.data('order_status'),
            $change_order_status = $popup.find('.woo-orders-tracking-order_status'),
            change_order_status = $change_order_status.val(),
            $tracking_content = $popup.find('.woo-orders-tracking-edit-tracking-content-body-row-details'),
            tracking_data = [], errors = [];
        let $tracking_number_column = $(`.woo-orders-tracking-edit-order-tracking[data-order_id="${order_id}"]`).closest('.woo-orders-tracking-tracking-number-column-container'),
            $overlay = $tracking_number_column.find('.woo-orders-tracking-edit-tracking-overlay');
        $tracking_content.find('>tr').map(function () {
            let $row = $(this), item_tracking_data = $row.data(),
                tracking_number = $row.find('.wot-admin-orders-item-tracking-number').val(),
                carrier_slug = $row.find('.wot-admin-orders-item-tracking-carrier').val();
            let selected_carrier = wot_get_carrier_by_slug(carrier_slug, custom_carriers_list);
            if (selected_carrier && selected_carrier.hasOwnProperty('digital_delivery') && selected_carrier.digital_delivery == 1) {
                if (item_tracking_data['carrier_slug'] !== carrier_slug) {
                    item_tracking_data['tracking_number'] = '';
                    item_tracking_data['carrier_slug'] = carrier_slug;
                    tracking_data.push({
                        item_id: item_tracking_data['item_id'],
                        tracking_number: '',
                        carrier_slug: carrier_slug,
                        add_to_paypal: 0,
                    });
                }
            } else {
                if (item_tracking_data['tracking_number'] && !tracking_number) {
                    errors.push({
                        item_id: item_tracking_data['item_id'],
                        quantity_index: item_tracking_data['quantity_index']
                    });
                } else if (tracking_number) {
                    let $paypal = $row.find('.wot-admin-orders-item-paypal');
                    item_tracking_data['add_to_paypal'] = 0;
                    if ($paypal.prop('checked') && !$paypal.prop('disabled')) {
                        item_tracking_data['add_to_paypal'] = 1;
                    }
                    if (item_tracking_data['tracking_number'] != tracking_number || item_tracking_data['carrier_slug'] !== carrier_slug || item_tracking_data['add_to_paypal'] || change_order_status !== `wc-${order_status}`) {
                        item_tracking_data['tracking_number'] = tracking_number;
                        item_tracking_data['carrier_slug'] = carrier_slug;
                        tracking_data.push({
                            item_id: item_tracking_data['item_id'],
                            tracking_number: tracking_number,
                            carrier_slug: carrier_slug,
                            add_to_paypal: item_tracking_data['add_to_paypal'],
                            quantity_index: item_tracking_data['quantity_index'],
                        });
                    }
                }
            }
        });
        $tracking_content.find('.wot-admin-orders-item-tracking-number-error').removeClass('wot-admin-orders-item-tracking-number-error');
        if (errors.length > 0) {
            villatheme_admin_show_message(vi_wot_admin_order_manager.i18n_delete_tracking_number_warning, 'error');
            $tracking_content.find('>tr').map(function () {
                let $tr = $(this);
                for (let i = 0; i < errors.length; i++) {
                    if ($tr.data('item_id') == errors[i].item_id && $tr.data('quantity_index') == errors[i].quantity_index) {
                        $tr.find('.wot-admin-orders-item-tracking-number').addClass('wot-admin-orders-item-tracking-number-error');
                        break;
                    }
                }
            })
        } else {
            $popup.find('.woo-orders-tracking-edit-tracking-button-cancel-all').trigger('click');
            if (tracking_data.length > 0) {
                let change_order_status_text = $change_order_status.find(':selected').html(),
                    send_email = $popup.find('.woo-orders-tracking-edit-tracking-send-email').prop('checked') ? 1 : 0,
                    send_sms = $popup.find('.woo-orders-tracking-edit-tracking-send-sms').prop('checked') ? 1 : 0;
                paypal_enable = $('#woo-orders-tracking-edit-tracking-content-body-row-paypal-bulk').prop('checked') ? 1 : '';
                $.ajax({
                    url: vi_wot_admin_order_manager.set_trackings_endpoint,
                    type: 'POST',
                    dataType: 'JSON',
                    data: {
                        order_id: order_id,
                        _wpnonce: vi_wot_admin_order_manager._wpnonce,
                        tracking_data: tracking_data,
                        send_email: send_email,
                        send_sms: send_sms,
                        change_order_status: change_order_status,
                    },
                    beforeSend: function () {
                        $overlay.removeClass('woo-orders-tracking-hidden');
                    },
                    success: function (response) {
                        let results = response.results;
                        for (let i = 0; i < results.length; i++) {
                            if (results[i].hasOwnProperty('add_to_paypal_result') && results[i]['add_to_paypal_result']) {
                                if (results[i]['add_to_paypal_result'].status === 'error') {
                                    let paypal_error = '';
                                    if (results[i]['add_to_paypal_result'].error_code) {
                                        paypal_error = `${results[i]['add_to_paypal_result'].error_code}: ${results[i]['add_to_paypal_result'].message}`;
                                    } else {
                                        paypal_error = results[i]['add_to_paypal_result'].message;
                                    }
                                    villatheme_admin_show_message(vi_wot_admin_order_manager.i18n_error_paypal.replace('{tracking_number}', results[i]['tracking_data'].tracking_number).replace('{order_id}', order_id), 'error', paypal_error);
                                }
                            }
                            if (send_sms && results[i].is_updated && !results[i].sms_sent) {
                                villatheme_admin_show_message(vi_wot_admin_order_manager.i18n_error_sms.replace('{order_id}', order_id), 'error');
                            }

                            if (results[i].error) {
                                villatheme_admin_show_message(vi_wot_admin_order_manager.i18n_error_tracking.replace('{tracking_number}', results[i]['tracking_data'].tracking_number).replace('{order_id}', order_id), 'error', results[i].error);
                            } else if (results[i].api_error) {
                                villatheme_admin_show_message(vi_wot_admin_order_manager.i18n_error_api.replace('{tracking_number}', results[i]['tracking_data'].tracking_number), 'error', results[i].api_error);
                            }
                        }
                        let need_refresh_tracking = false;
                        /*Refresh order status column to new status*/
                        if (change_order_status && response.hasOwnProperty('order_status_changed') && response.order_status_changed) {
                            $tracking_number_column.closest('tr').find('td.order_status .order-status').removeClass(`status-${order_status}`).addClass(`status-${change_order_status.substr(3)}`).html(`<span>${change_order_status_text}</span>`);
                            need_refresh_tracking = true;//to save the new value of "Change order status" option
                        }
                        if (parseInt(response.updated_items_count) > 0) {
                            need_refresh_tracking = true;
                            villatheme_admin_show_message(vi_wot_admin_order_manager.i18n_tracking_updated.replace('{order_id}', order_id), 'success', '', false, 3000);
                            if (send_email && !response.email_sent) {
                                villatheme_admin_show_message(vi_wot_admin_order_manager.i18n_error_email.replace('{order_id}', order_id), 'error');
                            }
                        } else {
                            $overlay.addClass('woo-orders-tracking-hidden');
                        }
                        if (need_refresh_tracking) {
                            refresh_tracking_numbers_column($tracking_number_column, $overlay, order_id, 1, change_order_status, send_email, send_sms);
                        }
                        $(document.body).trigger('woo_orders_tracking_admin_edit_trackings_success', response);
                    },
                    error: function (err) {
                        console.log(err)
                    },
                    complete: function () {

                    }
                });
            }
        }
    });

    function refresh_tracking_numbers_column($tracking_number_column, $overlay, order_id, update_settings = '', change_order_status = '', send_email = '', send_sms = '') {
        /*Refresh tracking number column after saving*/
        $.ajax({
            url: vi_wot_admin_order_manager.ajax_url,
            type: 'GET',
            dataType: 'JSON',
            data: {
                order_id: order_id,
                update_settings: update_settings,
                change_order_status: change_order_status,
                send_email: send_email,
                send_sms: send_sms,
                paypal_enable: paypal_enable,
                action: 'vi_wot_refresh_tracking_number_column',
                action_nonce: $('#_vi_wot_item_nonce').val(),
            },
            beforeSend: function () {
            },
            success: function (response) {
                if (response.status === 'success') {
                    $tracking_number_column.replaceWith($(response.html))
                }
            },
            error: function (err) {
                console.log(err)
            },
            complete: function () {
                $overlay.addClass('woo-orders-tracking-hidden');
            }
        });
    }

    /**
     * Toggle disabled status of tracking number field when changing tracking carrier between digital delivery carrier and normal carriers
     */
    $(document).on('change', '.wot-admin-orders-item-tracking-carrier', function () {
        let $selected_carrier = $(this);
        let selected_carrier = wot_get_carrier_by_slug($selected_carrier.val(), custom_carriers_list);
        let $tracking_number = $selected_carrier.closest('tr').find('.wot-admin-orders-item-tracking-number');
        if (selected_carrier && selected_carrier.hasOwnProperty('digital_delivery') && selected_carrier.digital_delivery == 1) {
            $tracking_number.prop('disabled', true);
        } else {
            $tracking_number.prop('disabled', false);
        }
    });
    /**
     * Toggle PayPal checkbox when tracking number or carrier slug change
     */
    $(document).on('change', '.wot-admin-orders-item-tracking-number,.wot-admin-orders-item-tracking-carrier', function () {
        let $button = $(this), $item = $button.closest('tr'), $paypal = $item.find('.wot-admin-orders-item-paypal'),
            tracking_number = $item.find('.wot-admin-orders-item-tracking-number').val(),
            carrier_slug = $item.find('.wot-admin-orders-item-tracking-carrier').val();
        if (!$item.hasClass('woo-orders-tracking-edit-tracking-content-body-row-item-focus')) {
            $popup.find('.woo-orders-tracking-edit-tracking-content-body-row-details tr').removeClass('woo-orders-tracking-edit-tracking-content-body-row-item-focus');
        }
        if (tracking_number && carrier_slug && $popup.find('.woo-orders-tracking-edit-tracking-button-save-all').data('paypal_available')) {
            if (tracking_number !== $item.data('tracking_number') || carrier_slug !== $item.data('carrier_slug')) {
                if ($paypal.prop('disabled')) {
                    $paypal.prop('disabled', false);
                }
                if ($popup.find('.woo-orders-tracking-edit-tracking-content-body-row-paypal-bulk').prop('checked')){
                    $paypal.prop('checked', true);
                }
            } else {
                if (!$paypal.prop('disabled') && $item.data('paypal_status').toString() === '2') {
                    $paypal.prop('disabled', true);
                }
            }
        } else {
            $paypal.prop('disabled', true);
        }
    });

    function enable_scroll() {
        let scrollTop = parseInt($('html').css('top'));
        $('html').removeClass('vi_wotg-noscroll');
        $('html,body').scrollTop(-scrollTop);
    }

    function disable_scroll() {
        if ($(document).height() > $(window).height()) {
            let scrollTop = ($('html').scrollTop()) ? $('html').scrollTop() : $('body').scrollTop(); // Works for Chrome, Firefox, IE...
            $('html').addClass('vi_wotg-noscroll').css('top', -scrollTop);
        }
    }

    /**
     * Close popup
     */
    $(document).on('click', '.woo-orders-tracking-overlay, .woo-orders-tracking-edit-tracking-close, .woo-orders-tracking-edit-tracking-button-cancel-all', function () {
        $popup.addClass('woo-orders-tracking-hidden');
        enable_scroll();
    });
    /**
     * Add keyboard event: enter + esc
     */
    $(document).on('keydown', function (e) {
        if (!$popup.hasClass('woo-orders-tracking-hidden')) {
            if ($popup.hasClass('woo-orders-tracking-edit-tracking-container-all')) {
                if (e.keyCode === 13) {
                    $('.woo-orders-tracking-edit-tracking-button-save-all').trigger('click');
                } else if (e.keyCode === 27) {
                    $('.woo-orders-tracking-edit-tracking-button-cancel-all').trigger('click');
                }
            }
        }
    });
    /**
     * Focus to a specific tracking number when clicking on edit button of a tracking number
     */
    $(document).on('click', '.woo-orders-tracking-edit-order-tracking-item', function () {
        let $button = $(this), $edit_all_button = $('.woo-orders-tracking-edit-order-tracking-all');
        focus_item.item_id = $button.closest('.woo-orders-tracking-tracking-number-container').data('item_id');
        focus_item.quantity_index = $button.closest('.woo-orders-tracking-tracking-number-container').data('quantity_index');
        if ($edit_all_button.length) {
            $edit_all_button.trigger('click');
        } else {
            $button.closest('.woo-orders-tracking-tracking-number-column-container').find('.woo-orders-tracking-edit-order-tracking').trigger('click');
        }
    });
    $(document.body).on('woo_orders_tracking_admin_edit_single_tracking_old_ui_success', function (e, response) {
        let $tracking_number_column = $('.woo-orders-tracking-tracking-number-column-container'),
            $overlay = $tracking_number_column.find('.woo-orders-tracking-edit-tracking-overlay');
        $overlay.removeClass('woo-orders-tracking-hidden');
        refresh_tracking_numbers_column($tracking_number_column, $overlay, $('.woo-orders-tracking-edit-order-tracking-all').data('order_id'));
    });
});