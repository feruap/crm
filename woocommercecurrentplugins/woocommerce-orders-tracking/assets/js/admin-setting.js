jQuery(document).ready(function ($) {
    'use strict';
    let type_carrier,
        $edit_shipping_container = $('.edit-shipping-carrier-html-container'),
        $add_shipping_container = $('.add-new-shipping-carrier-html-container'),
        shipping_country_carrier;
    $('.vi-ui.accordion').vi_accordion('refresh');
    /**
     * Copy shortcode
     */
    $('.wot-input-shortcode-field').on('click', function () {
        let $shortcode = $(this), $wrapper = $shortcode.parent();
        $shortcode.select();
        document.execCommand('copy');
        $wrapper.attr('data-tooltip', vi_wot_admin_settings.i18n_shortcode_copied);
        setTimeout(function () {
            $wrapper.attr('data-tooltip', vi_wot_admin_settings.i18n_copy_shortcode);
        }, 3000)
    });
    /**
     * Dynamically change type of secret field to password to avoid chrome's wrong password autofill
     */
    $('.woo-orders-tracking-setting-paypal-secret-live').map(function () {
        $(this).attr('type', 'password');
    });
    /**
     * Select a placeholder value on click
     */
    $('.woo-orders-tracking-placeholder-value').on('click', function () {
        $(this).select();
    });
    /**
     * Copy a placeholder value
     */
    $('.woo-orders-tracking-placeholder-value-copy').on('click', function () {
        let $container = $(this).closest('.woo-orders-tracking-placeholder-value-container');
        $container.find('.woo-orders-tracking-placeholder-value').select();
        document.execCommand('copy');
    });
    /**
     * Dependent fields when changing Woo email position
     */
    $('select[name="woo-orders-tracking-settings[email_woo][email_woo_position]"]').on('change', function () {
        let $before_order_table = $('.woo-orders-tracking-setting-email-woo-position-before_order_table'),
            $after_order_table = $('.woo-orders-tracking-setting-email-woo-position-after_order_table');
        if ($(this).val() === 'after_order_item') {
            $('.woo-orders-tracking-not_after_order_item').addClass('woo-orders-tracking-hidden');
        } else {
            $('.woo-orders-tracking-not_after_order_item').removeClass('woo-orders-tracking-hidden');
        }
        switch ($(this).val()) {
            case 'after_order_item':
                $before_order_table.addClass('woo-orders-tracking-hidden');
                $after_order_table.addClass('woo-orders-tracking-hidden');
                break;
            case 'before_order_table':
                $before_order_table.removeClass('woo-orders-tracking-hidden');
                $after_order_table.addClass('woo-orders-tracking-hidden');
                break;
            case 'after_order_table':
                $before_order_table.addClass('woo-orders-tracking-hidden');
                $after_order_table.removeClass('woo-orders-tracking-hidden');
                break;
            default:
        }
    });
    /**
     * Send test SMS
     */
    $('.woo-orders-tracking-button-send-test-sms').on('click', function () {
        let $button = $(this);
        if (!$button.hasClass('loading')) {
            let text = $('#woo-orders-tracking-sms_text_new').val();
            let provider = $('#woo-orders-tracking-sms_provider').val();
            let from_number = $('#woo-orders-tracking-sms_from_number').val();
            let app_id = $('#woo-orders-tracking-sms_' + provider + '_app_id').val();
            let app_token = $('#woo-orders-tracking-sms_' + provider + '_app_token').val();
            let powerpack = $('#woo-orders-tracking-sms_plivo_powerpack_uuid').val();
            let bitly_access_token = $('#woo-orders-tracking-bitly_access_token').val();
            let send_test_sms = $('#woo-orders-tracking-send_test_sms').val();
            if (!text) {
                text = $('#woo-orders-tracking-sms_text').val();
            }
            if (!text) {
                alert(vi_wot_admin_settings.i18n_sms_empty_message);
                return;
            }
            if (!send_test_sms) {
                alert(vi_wot_admin_settings.i18n_sms_empty_phone);
                return;
            }
            if (provider === 'plivo') {
                if (!app_id || !app_token || !powerpack) {
                    alert(vi_wot_admin_settings.i18n_sms_empty_api);
                    return;
                }
            } else {
                if (!app_id || !app_token) {
                    alert(vi_wot_admin_settings.i18n_sms_empty_api);
                    return;
                }
            }
            if (confirm(vi_wot_admin_settings.i18n_send_sms_to.replace('%s', send_test_sms))) {
                $.ajax({
                    url: vi_wot_admin_settings.ajax_url,
                    type: 'post',
                    data: {
                        action: 'woo_orders_tracking_send_test_sms',
                        text: text,
                        provider: provider,
                        from_number: from_number,
                        app_id: app_id,
                        app_token: app_token,
                        powerpack: powerpack,
                        bitly_access_token: bitly_access_token,
                        send_test_sms: send_test_sms,
                        action_nonce: $('#_vi_wot_setting_nonce').val(),
                    },
                    beforeSend: function () {
                        $button.addClass('loading');
                    },
                    success: function (response) {
                        if (response.message) {
                            alert(response.message);
                        } else {
                            alert(response.message_title);
                        }
                    },
                    error: function (err) {
                    },
                    complete: function () {
                        $button.removeClass('loading');
                    }
                });
            }
        }
    });

    /**
     * Select captcha version
     */
    $('#woo-orders-tracking-tracking_form_recaptcha_version').on('change', function () {
        let $recaptcha_theme = $('#woo-orders-tracking-tracking_form_recaptcha_theme').closest('tr');
        if ($(this).val() == 2) {
            $recaptcha_theme.removeClass('woo-orders-tracking-hidden');
        } else {
            $recaptcha_theme.addClass('woo-orders-tracking-hidden');
        }
    });
    /**
     * Change SMS provider
     */
    $('#woo-orders-tracking-sms_provider').on('change', function () {
        let sms_provider = $(this).val();
        let $from_number = $('#woo-orders-tracking-sms_from_number').closest('tr');
        let $sms_twilio_app = $('.woo-orders-tracking-sms_twilio_app');
        let $sms_nexmo_app = $('.woo-orders-tracking-sms_nexmo_app');
        let $sms_plivo_app = $('.woo-orders-tracking-sms_plivo_app');
        switch (sms_provider) {
            case 'twilio':
                $from_number.removeClass('woo-orders-tracking-hidden');
                $sms_twilio_app.removeClass('woo-orders-tracking-hidden');
                $sms_nexmo_app.addClass('woo-orders-tracking-hidden');
                $sms_plivo_app.addClass('woo-orders-tracking-hidden');
                break;
            case 'nexmo':
                $from_number.removeClass('woo-orders-tracking-hidden');
                $sms_twilio_app.addClass('woo-orders-tracking-hidden');
                $sms_nexmo_app.removeClass('woo-orders-tracking-hidden');
                $sms_plivo_app.addClass('woo-orders-tracking-hidden');
                break;
            case 'plivo':
                $from_number.addClass('woo-orders-tracking-hidden');
                $sms_twilio_app.addClass('woo-orders-tracking-hidden');
                $sms_nexmo_app.addClass('woo-orders-tracking-hidden');
                $sms_plivo_app.removeClass('woo-orders-tracking-hidden');
                break;
        }
    });
    /**
     * Change tracking service
     */
    $('.woo-orders-tracking-setting-service-carrier-type').on('change', function () {
        let $api = $('.woo-orders-tracking-tracking-service-api');
        if ($(this).val() === 'cainiao') {
            $api.addClass('woo-orders-tracking-hidden');
        } else {
            $api.removeClass('woo-orders-tracking-hidden');
        }
    });
    wotv_list_shipping_carriers();
    type_carrier = $('#woo-orders-tracking-setting-shipping-carriers-filter-type').val();
    shipping_country_carrier = $('#woo-orders-tracking-setting-shipping-carriers-filter-country').val();
    $('.vi-ui.vi-ui-main.tabular.menu .item').vi_tab({
        history: true,
        historyType: 'hash'
    });
    $('.vi-ui.vi-ui-shipment.menu .item').vi_tab();

    $('.vi-ui.dropdown').dropdown({placeholder: ''});
    $('.vi-ui.checkbox').checkbox();
    $('.woo-orders-tracking-setting-shipping-carriers-filter-country').select2();

    add_keyboard_event();

    function add_keyboard_event() {
        $(document).on('keydown', function (e) {
            if (!$add_shipping_container.hasClass('woo-orders-tracking-hidden')) {
                if (e.keyCode == 13) {
                    $('.add-new-shipping-carrier-html-btn-save').click();
                } else if (e.keyCode == 27) {
                    $('.add-new-shipping-carrier-html-btn-cancel').click();
                }
            } else if (!$edit_shipping_container.hasClass('woo-orders-tracking-hidden')) {
                if (e.keyCode == 13) {
                    $('.edit-shipping-carrier-html-btn-save').click();
                } else if (e.keyCode == 27) {
                    $('.edit-shipping-carrier-html-btn-cancel').click();
                }
            }
        });
    }

    $('.add-new-shipping-carrier-html-content-body-country, .edit-shipping-carrier-html-content-body-country').select2({
        placeholder: 'Please fill shipping country name',
        theme: 'add-new-shipping-carrier-select2'
    });
    $('.woo-orders-tracking-setting-service-carrier-api-key-' + $('#woo-orders-tracking-setting-service-carrier-type').val()).removeClass('woo-orders-tracking-hidden');
    $(document).on('change', '#woo-orders-tracking-setting-service-carrier-type', function () {
        $('.woo-orders-tracking-setting-service-carrier-api-key').addClass('woo-orders-tracking-hidden');
        $('.woo-orders-tracking-setting-service-carrier-api-key-' + $('#woo-orders-tracking-setting-service-carrier-type').val()).removeClass('woo-orders-tracking-hidden');
    });
    /**
     * Filter carriers by type
     */
    $(document).on('change', '#woo-orders-tracking-setting-shipping-carriers-filter-type', function () {
        type_carrier = $(this).val();
        let class_type = '';
        if (type_carrier === 'custom') {
            class_type = '.custom-shipping-carrier';
        }
        let class_shipping_country = '';

        if (shipping_country_carrier !== 'all_country') {
            class_shipping_country = '.shipping-country-' + shipping_country_carrier;
        }
        let search_key = $('.woo-orders-tracking-setting-shipping-carriers-filter-search').val().toLowerCase();
        if (search_key) {
            viWotSearch(class_type, class_shipping_country, search_key);
        } else {
            switch (type_carrier) {
                case 'all':
                    $('.woo-orders-tracking-setting-shipping-carriers-wrap' + class_shipping_country).removeClass('woo-orders-tracking-hidden');
                    break;
                case 'custom':
                    $('.woo-orders-tracking-setting-shipping-carriers-wrap').addClass('woo-orders-tracking-hidden');
                    $('.woo-orders-tracking-setting-shipping-carriers-wrap.custom-shipping-carrier' + class_shipping_country).removeClass('woo-orders-tracking-hidden');
                    break;
            }
        }
    });
    /**
     * Filter carriers by country
     */
    $(document).on('change', '#woo-orders-tracking-setting-shipping-carriers-filter-country', function () {
        shipping_country_carrier = $(this).val();
        let class_type = '',
            class_shipping_country = '';

        if (type_carrier === 'custom') {
            class_type = '.custom-shipping-carrier';
        }
        if (shipping_country_carrier !== 'all_country') {
            class_shipping_country = '.shipping-country-' + shipping_country_carrier;
        }
        let search_key = $('.woo-orders-tracking-setting-shipping-carriers-filter-search').val().toLowerCase();
        if (search_key) {
            viWotSearch(class_type, class_shipping_country, search_key);
        } else {
            $('.woo-orders-tracking-setting-shipping-carriers-wrap').addClass('woo-orders-tracking-hidden');
            $('.woo-orders-tracking-setting-shipping-carriers-wrap' + class_type + class_shipping_country).removeClass('woo-orders-tracking-hidden');
        }
        handle_no_results()
    });
    /**
     * Load carrier list when Shipping carriers tab is selected
     */
    let trackingmore_carriers, tracktry_carriers, loading_carriers_list = false,
        _17track_carriers;
    $('.vi-ui.attached.tabular.menu>.item[data-tab="shipping_carriers"]').on('click', function () {
        if (!loading_carriers_list) {
            loading_carriers_list = true;
            load_carriers_list();
        }
    });
    let url = window.location.href;
    if (url.indexOf('#shipping_carriers') > -1 || url.indexOf('#/shipping_carriers') > -1) {
        loading_carriers_list = true;
        load_carriers_list();
    }

    /**
     * Get list of supported carriers of tracking services which are not yet added to the plugin
     */
    function load_carriers_list() {
        let $trackingmore_carriers = $('#add-new-shipping-carrier-html-content-body-choose-from-trackingmore'),
            $17track_carriers = $('#add-new-shipping-carrier-html-content-body-choose-from-17track'),
            $tracktry_carriers = $('#add-new-shipping-carrier-html-content-body-choose-from-tracktry');
        if (!trackingmore_carriers || !_17track_carriers) {
            $.ajax({
                url: vi_wot_admin_settings.ajax_url,
                type: 'GET',
                data: {
                    action: 'wotv_admin_get_tracking_service_carriers',
                    action_nonce: $('#_vi_wot_setting_nonce').val(),
                },
                beforeSend: function () {

                },
                success: function (response) {
                    if (response.status === 'success') {
                        trackingmore_carriers = wot_sort_carriers(JSON.parse(response['trackingmore_carriers']));
                        _17track_carriers = JSON.parse(response['17track_carriers']);
                        tracktry_carriers = JSON.parse(response['tracktry_carriers']);
                        let html = '<option value=""></option>';
                        for (let i = 0; i < trackingmore_carriers.length; i++) {
                            html += `<option value="${trackingmore_carriers[i]['code']}">${trackingmore_carriers[i]['name']}</option>`;
                        }
                        $trackingmore_carriers.html(html);
                        html = '<option value=""></option>';
                        for (let i = 0; i < _17track_carriers.length; i++) {
                            html += `<option value="${_17track_carriers[i]['key']}">${_17track_carriers[i]['_name']}</option>`;
                        }
                        $17track_carriers.html(html);
                        html = '<option value=""></option>';
                        for (let i = 0; i < tracktry_carriers.length; i++) {
                            html += `<option value="${tracktry_carriers[i]['code']}">${tracktry_carriers[i]['name']}</option>`;
                        }
                        $tracktry_carriers.html(html);
                        $trackingmore_carriers.dropdown({
                            fullTextSearch: true,
                            forceSelection: false,
                            selectOnKeydown: false
                        });
                        $17track_carriers.dropdown({
                            fullTextSearch: true,
                            forceSelection: false,
                            selectOnKeydown: false
                        });
                        $tracktry_carriers.dropdown({
                            fullTextSearch: true,
                            forceSelection: false,
                            selectOnKeydown: false
                        })
                    }
                },
                error: function (err) {
                },
                complete: function () {
                    loading_carriers_list = false;
                }
            });
        }
    }

    /**
     * Add new carriers popup
     */
    $(document).on('click', '.woo-orders-tracking-setting-shipping-carriers-add-new-carrier', function () {
        wot_disable_scroll();
        $add_shipping_container.removeClass('woo-orders-tracking-hidden');
    });
    $(document).on('click', '.woo-orders-tracking-setting-shipping-carriers-add-new-carrier-shortcut', function (e) {
        e.preventDefault();
        $('.woo-orders-tracking-setting-shipping-carriers-add-new-carrier').click()
    });
    /**
     * Clear search(carriers)
     */
    $(document).on('search', '.woo-orders-tracking-setting-shipping-carriers-filter-search', function () {
        let $input = $(this);
        if (!$input.val()) {
            $input.trigger('keyup');
        }
    });
    /**
     * Search carriers
     */
    $(document).on('keyup', '.woo-orders-tracking-setting-shipping-carriers-filter-search', function () {
        let search_key = $(this).val().toLowerCase(),
            class_type = '',
            class_shipping_country = '';

        if (type_carrier === 'custom') {
            class_type = '.custom-shipping-carrier';
        }
        if (shipping_country_carrier !== 'all_country') {
            class_shipping_country = '.shipping-country-' + shipping_country_carrier;
        }
        if (search_key) {
            viWotSearch(class_type, class_shipping_country, search_key);
        } else {
            $('.woo-orders-tracking-setting-shipping-carriers-wrap' + class_type + class_shipping_country).removeClass('woo-orders-tracking-hidden');
        }
        handle_no_results();
    });

    function viWotSearch(class_type, class_shipping_country, search_key) {
        $('.woo-orders-tracking-setting-shipping-carriers-wrap').addClass('woo-orders-tracking-hidden');
        $('.woo-orders-tracking-setting-shipping-carriers-wrap' + class_type + class_shipping_country).each(function () {
            let shipping_carrier_name = $(this).attr('data-carrier_name').toLowerCase(),
                pattern = new RegExp(search_key);
            if (pattern.exec(shipping_carrier_name)) {
                $(this).removeClass('woo-orders-tracking-hidden');
            }
        });
    }

    /**
     * Suggest adding a new custom carrier if no results found
     */
    function handle_no_results() {
        let $found_carriers = $('.woo-orders-tracking-setting-shipping-carriers-wrap:not(.woo-orders-tracking-hidden)'),
            $search_not_found = $('.woo-orders-tracking-setting-shipping-carriers-list-search-wrap');
        if ($found_carriers.length === 0) {
            $search_not_found.removeClass('woo-orders-tracking-hidden');
        } else {
            $search_not_found.addClass('woo-orders-tracking-hidden');
        }
    }

    /**
     * Show actions button on hovering over a carrier
     */
    $(document).on('mouseenter', '.woo-orders-tracking-setting-shipping-carriers-wrap', function () {
        $(this).addClass('custom-shipping-carrier-show-action');
        $(this).find('.woo-orders-tracking-setting-custom-shipping-carrier-action').removeClass('woo-orders-tracking-hidden');
    });
    /**
     * Hide actions button on hovering out of a carrier
     */
    $(document).on('mouseleave', '.woo-orders-tracking-setting-shipping-carriers-wrap', function () {
        $(this).removeClass('custom-shipping-carrier-show-action');
        $(this).find('.woo-orders-tracking-setting-custom-shipping-carrier-action').addClass('woo-orders-tracking-hidden');
    });
    /**
     * Close popup
     */
    $(document).on('click', '.woo-orders-tracking-overlay , .add-new-shipping-carrier-html-content-close, .add-new-shipping-carrier-html-btn-cancel ,.edit-shipping-carrier-html-content-close, .edit-shipping-carrier-html-btn-cancel', function () {
        if ($(this).closest('.woo-orders-tracking-footer-container').hasClass('add-new-shipping-carrier-html-container')) {
            $('#woo-orders-tracking-setting-shipping-carriers-filter-type').val('all').trigger('change');
        }
        $('.woo-orders-tracking-footer-container').addClass('woo-orders-tracking-hidden');
        wot_enable_scroll();
    });
    /**
     * Add new carrier confirm
     */
    $(document).on('click', '.add-new-shipping-carrier-html-btn-save', function () {
        if (!$('#add-new-shipping-carrier-html-content-body-carrier-name').val() || !$('.add-new-shipping-carrier-html-content-body-country').val() || !$('#add-new-shipping-carrier-html-content-body-carrier-url').val()) {
            alert(vi_wot_admin_settings.add_new_error_empty_field);
            return false;
        }
        let data = {
            action: 'wotv_admin_add_new_shipping_carrier',
            action_nonce: $('#_vi_wot_setting_nonce').val(),
            carrier_name: $('#add-new-shipping-carrier-html-content-body-carrier-name').val(),
            carrier_slug: $('#add-new-shipping-carrier-html-content-body-carrier-slug').val(),
            display_name: $('#add-new-shipping-carrier-html-content-body-carrier-display-name').val(),
            shipping_country: $('#add-new-shipping-carrier-html-content-body-country').val(),
            tracking_url: $('#add-new-shipping-carrier-html-content-body-carrier-url').val(),
            digital_delivery: $('.add-new-shipping-carrier-is-digital-delivery').prop('checked') ? 1 : 0,
            from_service: $('#add-new-shipping-carrier-html-content-body-add-carrier-type').val()
        };
        $.ajax({
            url: vi_wot_admin_settings.ajax_url,
            type: 'post',
            data: data,
            beforeSend: function () {
                $('.add-new-shipping-carrier-html-btn-save').addClass('loading');
            },
            success: function (response) {
                if (response.status === 'success') {
                    $(wotv_html_shipping_carrier(response.carrier, true)).insertAfter($('.woo-orders-tracking-setting-shipping-carriers-list-wrap').find('.woo-orders-tracking-setting-shipping-carriers-wrap').eq(0))
                    $('.woo-orders-tracking-setting-shipping-carriers-list-wrap .vi-ui.checkbox').checkbox();
                    $('#add-new-shipping-carrier-html-content-body-carrier-name,#add-new-shipping-carrier-html-content-body-country, #add-new-shipping-carrier-html-content-body-carrier-url').val(null);
                    $('.woo-orders-tracking-overlay').click();
                    villatheme_admin_show_message(vi_wot_admin_settings.i18n_added_carrier.replace('%s', response.carrier.name), 'success', '', false, 3000);
                } else {
                    villatheme_admin_show_message(response.message, 'error');
                }
            },
            error: function (err) {
            },
            complete: function () {
                $('.add-new-shipping-carrier-html-btn-save').removeClass('loading');
            }
        });
    });
    /**
     * Digital delivery carrier checkbox(add new)
     */
    $(document).on('click', '.add-new-shipping-carrier-is-digital-delivery', function () {
        let $button = $(this);
        let $container = $button.closest('.add-new-shipping-carrier-html-content-body');
        let $error = $container.find('.wotv-error-tracking-url');
        if ($button.prop('checked')) {
            $error.addClass('woo-orders-tracking-hidden')
        } else {
            let carrier_url = $('#add-new-shipping-carrier-html-content-body-carrier-url').val();
            if (carrier_url.indexOf('{tracking_number}') === -1) {
                $error.removeClass('woo-orders-tracking-hidden');
            } else {
                $error.addClass('woo-orders-tracking-hidden');
            }
        }
    });
    /**
     * Digital delivery carrier checkbox(edit)
     */
    $(document).on('click', '.edit-shipping-carrier-is-digital-delivery', function () {
        let $button = $(this);
        let $container = $button.closest('.edit-shipping-carrier-html-content-body');
        let $error = $container.find('.wotv-error-tracking-url');
        if ($button.prop('checked')) {
            $error.addClass('woo-orders-tracking-hidden')
        } else {
            let carrier_url = $('#edit-shipping-carrier-html-content-body-carrier-url').val();
            if (carrier_url.indexOf('{tracking_number}') === -1) {
                $error.removeClass('woo-orders-tracking-hidden');
            } else {
                $error.addClass('woo-orders-tracking-hidden');
            }
        }
    });
    $('#edit-shipping-carrier-html-content-body-carrier-url').on('keyup', function () {
        let carrier_url = $(this).val();
        let $digital_delivery = $('.edit-shipping-carrier-is-digital-delivery');
        if (!$digital_delivery.prop('checked')) {
            if (carrier_url.indexOf('{tracking_number}') === -1) {
                $(this).parent().find('.wotv-error-tracking-url').removeClass('woo-orders-tracking-hidden');
            } else {
                $(this).parent().find('.wotv-error-tracking-url').addClass('woo-orders-tracking-hidden');
            }
        }
    });
    $('#add-new-shipping-carrier-html-content-body-carrier-url').on('keyup', function () {
        let carrier_url = $(this).val();
        let $digital_delivery = $('.add-new-shipping-carrier-is-digital-delivery');
        if (!$digital_delivery.prop('checked')) {
            if (carrier_url.indexOf('{tracking_number}') === -1) {
                $(this).parent().find('.wotv-error-tracking-url').removeClass('woo-orders-tracking-hidden');
            } else {
                $(this).parent().find('.wotv-error-tracking-url').addClass('woo-orders-tracking-hidden');
            }
        }
    });


    $(document).on('click', '.woo-orders-tracking-setting-custom-shipping-carrier-action-edit', function () {
        $('.woo-orders-tracking-setting-shipping-carriers-wrap-editing').removeClass('woo-orders-tracking-setting-shipping-carriers-wrap-editing');
        wot_disable_scroll();
        $edit_shipping_container.removeClass('woo-orders-tracking-hidden');
        let $button = $(this), shipping_carrier_data = $button.data(),
            $save_button = $('.edit-shipping-carrier-html-btn-save'),
            carrier_slug = shipping_carrier_data['carrier_slug'],
            carrier_name = shipping_carrier_data['carrier_name'],
            display_name = shipping_carrier_data['display_name'],
            shipping_country = shipping_carrier_data['shipping_country'],
            carrier_url = shipping_carrier_data['carrier_url'],
            digital_delivery = shipping_carrier_data['digital_delivery'];
        if (shipping_carrier_data.hasOwnProperty('type') && shipping_carrier_data.type === 'custom') {
            if ($button.data('from_service') && $button.data('from_carrier')) {
                $('#edit-shipping-carrier-html-content-body-carrier-name').prop('readonly', true);
                $('#edit-shipping-carrier-is-digital-delivery').prop('disabled', true);
            } else {
                $('#edit-shipping-carrier-html-content-body-carrier-name').prop('readonly', false);
                $('#edit-shipping-carrier-is-digital-delivery').prop('disabled', false);
            }
            $('#edit-shipping-carrier-html-content-body-country').prop('disabled', false);
            $('#edit-shipping-carrier-html-content-body-carrier-url').prop('readonly', false);
        } else {
            $('#edit-shipping-carrier-html-content-body-carrier-name').prop('readonly', true);
            $('#edit-shipping-carrier-html-content-body-country').prop('disabled', true);
            $('#edit-shipping-carrier-html-content-body-carrier-url').prop('readonly', true);
            $('#edit-shipping-carrier-is-digital-delivery').prop('disabled', true);
        }

        $('#edit-shipping-carrier-html-content-body-carrier-name').val(carrier_name);
        $('#edit-shipping-carrier-html-content-body-carrier-display-name').val(display_name);
        $('#edit-shipping-carrier-html-content-body-country').val(shipping_country).trigger('change');
        $('#edit-shipping-carrier-html-content-body-carrier-url').val(carrier_url);
        $('.edit-shipping-carrier-is-digital-delivery').prop('checked', digital_delivery == 1);
        $save_button.data('carrier_slug', carrier_slug);
        $save_button.data('carrier_name', carrier_name);
        $save_button.data('display_name', display_name);
        $save_button.data('shipping_country', shipping_country);
        $save_button.data('carrier_url', carrier_url);
        $save_button.data('digital_delivery', digital_delivery);
        $(this).closest('.woo-orders-tracking-setting-shipping-carriers-wrap').addClass('woo-orders-tracking-setting-shipping-carriers-wrap-editing');
        if (carrier_url.indexOf('{tracking_number}') === -1 && digital_delivery != 1) {
            $edit_shipping_container.find('.wotv-error-tracking-url').removeClass('woo-orders-tracking-hidden');
        } else {
            $edit_shipping_container.find('.wotv-error-tracking-url').addClass('woo-orders-tracking-hidden');
        }
    });
    $(document).on('click', '.edit-shipping-carrier-html-btn-save', function () {
        let shipping_carrier_data = $(this).data(),
            display_name = $('#edit-shipping-carrier-html-content-body-carrier-display-name').val(),
            carrier_name = $('#edit-shipping-carrier-html-content-body-carrier-name').val(),
            shipping_country = $('#edit-shipping-carrier-html-content-body-country').val(),
            carrier_url = $('#edit-shipping-carrier-html-content-body-carrier-url').val(),
            digital_delivery = $('.edit-shipping-carrier-is-digital-delivery').prop('checked') ? 1 : 0;
        if (!carrier_name || !shipping_country || !carrier_url) {
            alert(vi_wot_admin_settings.add_new_error_empty_field);
            return false;
        }
        if (display_name === shipping_carrier_data['display_name'] && carrier_name === shipping_carrier_data['carrier_name'] && carrier_url === shipping_carrier_data['carrier_url'] && shipping_country === shipping_carrier_data['shipping_country'] && digital_delivery == shipping_carrier_data['digital_delivery']) {
            $('.woo-orders-tracking-footer-container').addClass('woo-orders-tracking-hidden');
            wot_enable_scroll();
            return false;
        }
        let div = $('.woo-orders-tracking-setting-shipping-carriers-wrap-editing'),
            data = {
                action: 'wotv_admin_edit_shipping_carrier',
                action_nonce: $('#_vi_wot_setting_nonce').val(),
                carrier_slug: shipping_carrier_data['carrier_slug'],
                display_name: display_name,
                carrier_name: carrier_name,
                shipping_country: shipping_country,
                tracking_url: carrier_url,
                digital_delivery: digital_delivery,
            };
        $.ajax({
            url: vi_wot_admin_settings.ajax_url,
            type: 'post',
            data: data,
            beforeSend: function () {
                $('.edit-shipping-carrier-html-btn-save').addClass('loading');
            },
            success: function (response) {
                if (response.status === 'success') {
                    div.data('carrier_name', response.carrier_name);
                    div.find('.woo-orders-tracking-setting-custom-shipping-carrier-action-edit').data('carrier_name', response.carrier_name).data('display_name', response.display_name).data('shipping_country', response.shipping_country).data('carrier_url', response.tracking_url).data('digital_delivery', response.digital_delivery);
                    div.find('.woo-orders-tracking-setting-shipping-carrier-name a').html('<a href="' + response.tracking_url + '" target="_blank">' + response.carrier_name + '</a>');
                    div.find('.woo-orders-tracking-setting-shipping-carrier-display-name-input').val(response.display_name);
                    shipping_carrier_data['carrier_name'] = response.carrier_name;
                    shipping_carrier_data['display_name'] = response.display_name;
                    shipping_carrier_data['carrier_url'] = response.tracking_url;
                    shipping_carrier_data['shipping_country'] = response.shipping_country;
                } else {
                }
            },
            error: function (err) {
            },
            complete: function () {
                $('.edit-shipping-carrier-html-btn-save').removeClass('loading');
                $('.woo-orders-tracking-footer-container').addClass('woo-orders-tracking-hidden');
                wot_enable_scroll();
            }
        });
    });
    /**
     * Copy carrier slug
     */
    $(document).on('click', '.woo-orders-tracking-setting-custom-shipping-carrier-action-copy', function () {
        $('.woo-orders-tracking-copy-carrier-successful').remove();
        let $container = $(this).closest('.woo-orders-tracking-setting-shipping-carriers-wrap');
        $container.find('.woo-orders-tracking-setting-shipping-carrier-slug-input').select();
        document.execCommand('copy');
        let $result_icon = $('<span class="woo-orders-tracking-copy-carrier-successful dashicons dashicons-yes" title="Copied slug to clipboard"></span>');
        let $carrier_slug_container = $container.find('.woo-orders-tracking-setting-shipping-carrier-slug');
        $carrier_slug_container.append($result_icon);
    });
    /**
     * Set a carrier as default
     */
    $(document).on('click', '.woo-orders-tracking-setting-custom-shipping-carrier-action-default', function () {
        let $current = $(this),
            $container = $current.closest('.woo-orders-tracking-setting-shipping-carriers-wrap'),
            $active = $container.find('.woo-orders-tracking-setting-shipping-carrier-action-active'),
            $active_wrap = $active.closest('.vi-ui.checkbox'),
            $wrap = $current.closest('.woo-orders-tracking-setting-shipping-carriers-list-wrap');
        $wrap.find('.woo-orders-tracking-setting-shipping-carrier-action-active-wrap>.vi-ui.checkbox').removeClass('disabled');
        if (!$active.prop('checked')) {
            $active.prop('checked', true).trigger('change');
        }
        $active_wrap.addClass('disabled');
        $wrap.prepend($container);
    });
    $('.woo-orders-tracking-setting-shipping-carriers-toggle-active').on('change', function () {
        if ($(this).prop('checked')) {
            $('.woo-orders-tracking-setting-shipping-carrier-action-active').prop('checked', true).trigger('change');
        } else {
            $('.woo-orders-tracking-setting-shipping-carrier-action-active').prop('checked', false).trigger('change');
            $('.woo-orders-tracking-setting-shipping-carrier-action-active').eq(0).prop('checked', true).trigger('change');
        }
    });
    /**
     * Delete a custom carrier
     */
    $(document).on('click', '.woo-orders-tracking-setting-custom-shipping-carrier-action-delete', function () {
        if (confirm(vi_wot_admin_settings.confirm_delete_carrier_custom)) {
            let overlay = $('.woo-orders-tracking-setting-shipping-carriers-overlay');
            let div = $(this).closest('.woo-orders-tracking-setting-shipping-carriers-wrap'),
                data = {
                    action: 'wotv_admin_delete_shipping_carrier',
                    action_nonce: $('#_vi_wot_setting_nonce').val(),
                    carrier_slug: $(this).data('carrier_slug'),
                };
            $.ajax({
                url: vi_wot_admin_settings.ajax_url,
                type: 'post',
                data: data,
                beforeSend: function () {
                    overlay.removeClass('woo-orders-tracking-hidden');
                },
                success: function (response) {
                    if (response.status === 'success') {
                        div.remove();
                    } else {
                    }
                },
                error: function (err) {
                },
                complete: function () {
                    overlay.addClass('woo-orders-tracking-hidden');
                    $('.woo-orders-tracking-setting-shipping-carriers-list-wrap .woo-orders-tracking-setting-custom-shipping-carrier-action-default').eq(0).click();
                }
            });
        }
    });

    /**
     * Preview email
     */
    $(document).on('click', '.woo-orders-tracking-preview-emails-button', function () {
        let $button = $(this);
        $button.html('Please wait...');
        let language = $(this).data('wot_language');
        let data = {
            action: 'wot_preview_emails',
            heading: $('#woo-orders-tracking-setting-email-heading' + language).val(),
            email_column_tracking_number: tinyMCE.get('wot-email_column_tracking_number' + language) ? tinyMCE.get('wot-email_column_tracking_number' + language).getContent() : $('#wot-email_column_tracking_number' + language).val(),
            email_column_carrier_name: tinyMCE.get('wot-email_column_carrier_name' + language) ? tinyMCE.get('wot-email_column_carrier_name' + language).getContent() : $('#wot-email_column_carrier_name' + language).val(),
            email_column_tracking_url: tinyMCE.get('wot-email_column_tracking_url' + language) ? tinyMCE.get('wot-email_column_tracking_url' + language).getContent() : $('#wot-email_column_tracking_url' + language).val(),
            content: tinyMCE.get('wot-email-content' + language) ? tinyMCE.get('wot-email-content' + language).getContent() : $('#wot-email-content' + language).val(),
            action_nonce: $('#_vi_wot_setting_nonce').val(),
        };

        $.ajax({
            url: vi_wot_admin_settings.ajax_url,
            type: 'GET',
            dataType: 'JSON',
            data: data,
            success: function (response) {
                $button.html('Preview emails');
                if (response) {
                    $('.preview-emails-html').html(response.html);
                    wot_disable_scroll();
                    $('.preview-emails-html-container').removeClass('woo-orders-tracking-hidden');
                }
            },
            error: function (err) {
                $('.woo-orders-tracking-preview-emails-button').html('Preview emails');
            }
        });
    });
    /**
     * Toggle PayPal sandbox
     */
    $('.woo-orders-tracking-setting-paypal-sandbox-enable-checkbox').each(function () {
        if ($(this).prop('checked')) {
            $(this).closest('.wot-paypal-app-content').find('.woo-orders-tracking-setting-paypal-live-wrap').removeClass('woo-orders-tracking-setting-paypal-live-wrap-show').addClass('woo-orders-tracking-hidden');
            $(this).closest('.wot-paypal-app-content').find('.woo-orders-tracking-setting-paypal-sandbox-wrap').removeClass('woo-orders-tracking-hidden');
        } else {
            $(this).closest('.wot-paypal-app-content').find('.woo-orders-tracking-setting-paypal-live-wrap').removeClass('woo-orders-tracking-hidden').addClass('woo-orders-tracking-setting-paypal-live-wrap-show');
            $(this).closest('.wot-paypal-app-content').find('.woo-orders-tracking-setting-paypal-sandbox-wrap').addClass('woo-orders-tracking-hidden');
        }
        $(this).on('change', function () {
            if ($(this).prop('checked')) {
                $(this).parent().parent().find('.woo-orders-tracking-setting-paypal-sandbox-enable').val('1');
                $(this).closest('.wot-paypal-app-content').find('.woo-orders-tracking-setting-paypal-live-wrap').removeClass('woo-orders-tracking-setting-paypal-live-wrap-show').addClass('woo-orders-tracking-hidden');
                $(this).closest('.wot-paypal-app-content').find('.woo-orders-tracking-setting-paypal-sandbox-wrap').removeClass('woo-orders-tracking-hidden');
            } else {
                $(this).parent().parent().find('.woo-orders-tracking-setting-paypal-sandbox-enable').val('');
                $(this).closest('.wot-paypal-app-content').find('.woo-orders-tracking-setting-paypal-live-wrap').removeClass('woo-orders-tracking-hidden').addClass('woo-orders-tracking-setting-paypal-live-wrap-show');
                $(this).closest('.wot-paypal-app-content').find('.woo-orders-tracking-setting-paypal-sandbox-wrap').addClass('woo-orders-tracking-hidden');
            }
        });
    });

    /**
     * Test PayPal connection
     */
    $('.wot-paypal-app-content-action-test-api').on('click', function () {
        let data, div, parent, btnt_test;
        btnt_test = $(this);
        div = btnt_test.closest('.wot-paypal-app-content');
        parent = btnt_test.closest('td');
        parent.find('.woo-orders-tracking-setting-paypal-btn-check-api-text').html('');
        div.find('input[type ="text"]').removeAttr('style');
        if (div.find('.woo-orders-tracking-setting-paypal-sandbox-enable-checkbox').prop('checked')) {
            if (!div.find('.woo-orders-tracking-setting-paypal-client-id-sandbox').val()) {
                div.find('.woo-orders-tracking-setting-paypal-client-id-sandbox').css('border-color', 'red');
                return false;
            }
            if (!div.find('.woo-orders-tracking-setting-paypal-secret-sandbox').val()) {
                div.find('.woo-orders-tracking-setting-paypal-secret-sandbox').css('border-color', 'red');
                return false;
            }
            data = {
                action: 'wot_test_connection_paypal',
                client_id: div.find('.woo-orders-tracking-setting-paypal-client-id-sandbox').val(),
                secret: div.find('.woo-orders-tracking-setting-paypal-secret-sandbox').val(),
                sandbox: 'yes',
                action_nonce: $('#_vi_wot_setting_nonce').val(),
            };
        } else {
            if (!div.find('.woo-orders-tracking-setting-paypal-client-id-live').val()) {
                div.find('.woo-orders-tracking-setting-paypal-client-id-live').css('border-color', 'red');
                return false;
            }
            if (!div.find('.woo-orders-tracking-setting-paypal-secret-live').val()) {
                div.find('.woo-orders-tracking-setting-paypal-secret-live').css('border-color', 'red');
                return false;
            }
            data = {
                action: 'wot_test_connection_paypal',
                client_id: div.find('.woo-orders-tracking-setting-paypal-client-id-live').val(),
                secret: div.find('.woo-orders-tracking-setting-paypal-secret-live').val(),
                sandbox: 'no',
                action_nonce: $('#_vi_wot_setting_nonce').val(),
            };
        }
        $.ajax({
            url: vi_wot_admin_settings.ajax_url,
            type: 'POST',
            dataType: 'JSON',
            data: data,
            beforeSend: function () {
                btnt_test.addClass('loading');
            },
            success: function (response) {
                parent.find('.woo-orders-tracking-setting-paypal-btn-check-api-text').html(response.message);
                div.find('input[type ="text"]').removeAttr('style');
            },
            error: function (err) {
            },
            complete: function () {
                btnt_test.removeClass('loading');
            }
        });
    });

    function wot_enable_scroll() {
        let scrollTop = parseInt($('html').css('top'));
        $('html').removeClass('wot-noscroll');
        $('html,body').scrollTop(-scrollTop);
    }

    function wot_disable_scroll() {
        if ($(document).height() > $(window).height()) {
            let scrollTop = ($('html').scrollTop()) ? $('html').scrollTop() : $('body').scrollTop(); // Works for Chrome, Firefox, IE...
            $('html').addClass('wot-noscroll').css('top', -scrollTop);
        }
    }


    function wotv_html_shipping_carrier(data, is_active) {
        let html = '';
        let checked = 'checked="checked"',
            class_type = 'define-shipping-carrier',
            class_shipping_country = 'shipping-country-' + data.country,
            display_name = data.hasOwnProperty('display_name') ? data.display_name : data.name,
            custom_carrier = '';

        if (data.type && data.type === 'custom') {
            custom_carrier = 'yes';
            class_type = 'custom-shipping-carrier';
        }
        html += '<div class="woo-orders-tracking-setting-shipping-carriers-wrap ' + class_shipping_country + ' ' + class_type + '" data-country="' + data.country + '"  data-carrier_name="' + data.name + '"  data-custom_carrier="' + custom_carrier + '">';
        html += '<div class="woo-orders-tracking-setting-shipping-carrier-name">';
        html += '<a href="' + data.url + '" target="_blank">' + data.name + '</a>';
        html += '<div class="woo-orders-tracking-setting-custom-shipping-carrier-action woo-orders-tracking-hidden">';
        html += '<i class="copy outline icon woo-orders-tracking-setting-custom-shipping-carrier-action-copy green" data-carrier_slug="' + data.slug + '" title="Copy carrier slug"></i>';
        html += '<i class="hand point up outline icon woo-orders-tracking-setting-custom-shipping-carrier-action-default green" data-carrier_slug="' + data.slug + '" title="Set default"></i>';
        if (custom_carrier === 'yes') {
            let digital_delivery = 0;
            if (data.hasOwnProperty('digital_delivery') && data.digital_delivery == 1) {
                digital_delivery = 1;
            }
            let from_service = data.hasOwnProperty('from_service') ? data.from_service : '',
                from_carrier = data.hasOwnProperty('from_carrier') ? data.from_carrier : '';
            html += '<i class="edit outline icon woo-orders-tracking-setting-custom-shipping-carrier-action-edit blue" data-type="' + data.type + '" data-from_carrier="' + from_carrier + '" data-from_service="' + from_service + '" data-carrier_slug="' + data.slug + '" data-display_name="' + display_name + '" data-carrier_name="' + data.name + '" data-shipping_country="' + data.country + '" data-carrier_url="' + data.url + '" data-digital_delivery="' + digital_delivery + '"></i>';
            html += '<i class="trash alternate outline icon woo-orders-tracking-setting-custom-shipping-carrier-action-delete red" data-carrier_slug="' + data.slug + '"></i>';
        } else {
            html += '<i class="edit outline icon woo-orders-tracking-setting-custom-shipping-carrier-action-edit blue" data-type="' + data.type + '" data-carrier_slug="' + data.slug + '" data-display_name="' + display_name + '" data-carrier_name="' + data.name + '" data-shipping_country="' + data.country + '" data-carrier_url="' + data.url + '"></i>';
        }
        html += '</div>';
        html += '</div>';
        html += '<div class="woo-orders-tracking-setting-shipping-carrier-display-name" title="' + vi_wot_admin_settings.display_name_title + '"><input class="woo-orders-tracking-setting-shipping-carrier-display-name-input" type="text" value="' + display_name + '" readonly></div>';
        html += '<div class="woo-orders-tracking-setting-shipping-carrier-slug"><input class="woo-orders-tracking-setting-shipping-carrier-slug-input" type="text" value="' + data.slug + '" readonly></div>';
        html += '<div class="woo-orders-tracking-setting-shipping-carrier-action">';
        html += '<div class="woo-orders-tracking-setting-shipping-carrier-action-active-wrap">';
        html += '<div class="vi-ui toggle checkbox"><input name="woo-orders-tracking-settings[active_carriers][]" type="checkbox" class="woo-orders-tracking-setting-shipping-carrier-action-active" id="woo-orders-tracking-setting-shipping-carrier-action-active-' + data.slug + '" value="' + data.slug + '"';
        if (is_active) {
            html += checked;
        }
        html += '/>';
        html += '<label for="woo-orders-tracking-setting-shipping-carrier-action-active-' + data.slug + '"><span>' + vi_wot_admin_settings.i18n_active_carrier + '</span></label></div>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    function wotv_list_shipping_carriers() {
        let carriers = vi_wot_admin_settings.carriers;
        let html = '';
        let active_carriers = '', default_carrier = '';
        carriers = wot_sort_carriers(carriers);
        if (vi_wot_admin_settings.active_carriers.length > 0) {
            for (let i = 0; i < carriers.length; i++) {
                if (carriers[i]['slug'] === vi_wot_admin_settings.shipping_carrier_default) {
                    default_carrier = wotv_html_shipping_carrier(carriers[i], true);
                } else if (vi_wot_admin_settings.active_carriers.indexOf(carriers[i]['slug']) > -1) {
                    active_carriers += wotv_html_shipping_carrier(carriers[i], true);
                } else {
                    html += wotv_html_shipping_carrier(carriers[i]);
                }
            }
        } else {
            for (let i = 0; i < carriers.length; i++) {
                if (carriers[i]['slug'] === vi_wot_admin_settings.shipping_carrier_default) {
                    default_carrier = wotv_html_shipping_carrier(carriers[i], true);
                } else {
                    html += wotv_html_shipping_carrier(carriers[i], true);
                }
            }
        }
        html = default_carrier + active_carriers + html;
        $('.woo-orders-tracking-setting-shipping-carriers-list-wrap').html(html);
        setTimeout(function () {
            $('.woo-orders-tracking-setting-shipping-carriers-list-wrap .woo-orders-tracking-setting-custom-shipping-carrier-action-default').eq(0).click();
            if (!$('.woo-orders-tracking-setting-shipping-carriers-filter-search').length) {
                $('.woo-orders-tracking-setting-shipping-carriers-search-wrap').append($(`<input type="search" placeholder="${vi_wot_admin_settings.i18n_search_carrier}" class="woo-orders-tracking-setting-shipping-carriers-filter-search">`))
            }
        }, 100)
    }

    $('body').on('change', '.woo-orders-tracking-string-replace-sensitive', function () {
        let $container = $(this).closest('.woo-orders-tracking-string-replace-sensitive-container');
        let $sensitive_value = $container.find('.woo-orders-tracking-string-replace-sensitive-value');
        let sensitive_value = $(this).prop('checked') ? 1 : '';
        $sensitive_value.val(sensitive_value);
    });
    $('body').on('click', '.delete-string-replace-rule', function () {
        if (confirm(vi_wot_admin_settings.confirm_delete_string_replace)) {
            $(this).closest('.clone-source').remove();
        }
    });
    /*Search page*/
    $('.search-page').select2({
        allowClear: true,
        closeOnSelect: true,
        placeholder: 'Please fill in your page title',
        ajax: {
            url: "admin-ajax.php?action=woo_orders_tracking_search_page",
            dataType: 'json',
            type: "GET",
            quietMillis: 50,
            delay: 250,
            data: function (params) {
                return {
                    keyword: params.term
                };
            },
            processResults: function (data) {
                return {
                    results: data
                };
            },
            cache: true
        },
        escapeMarkup: function (markup) {
            return markup;
        }, // let our custom formatter work
        minimumInputLength: 1
    });
    /**
     * Start Get download key
     */
    jQuery('.villatheme-get-key-button').one('click', function (e) {
        let v_button = jQuery(this);
        v_button.addClass('loading');
        let data = v_button.data();
        let item_id = data.id;
        let app_url = data.href;
        let main_domain = window.location.hostname;
        main_domain = main_domain.toLowerCase();
        let popup_frame;
        e.preventDefault();
        let download_url = v_button.attr('data-download');
        popup_frame = window.open(app_url, "myWindow", "width=380,height=600");
        window.addEventListener('message', function (event) {
            /*Callback when data send from child popup*/
            let obj = JSON.parse(event.data);
            let update_key = '';
            let message = obj.message;
            let support_until = '';
            let check_key = '';
            if (obj['data'].length > 0) {
                for (let i = 0; i < obj['data'].length; i++) {
                    if (obj['data'][i].id == item_id && (obj['data'][i].domain == main_domain || obj['data'][i].domain == '' || obj['data'][i].domain == null)) {
                        if (update_key == '') {
                            update_key = obj['data'][i].download_key;
                            support_until = obj['data'][i].support_until;
                        } else if (support_until < obj['data'][i].support_until) {
                            update_key = obj['data'][i].download_key;
                            support_until = obj['data'][i].support_until;
                        }
                        if (obj['data'][i].domain == main_domain) {
                            update_key = obj['data'][i].download_key;
                            break;
                        }
                    }
                }
                if (update_key) {
                    check_key = 1;
                    jQuery('.villatheme-autoupdate-key-field').val(update_key);
                }
            }
            v_button.removeClass('loading');
            if (check_key) {
                jQuery('<p><strong>' + message + '</strong></p>').insertAfter(".villatheme-autoupdate-key-field");
                jQuery(v_button).closest('form').submit();
            } else {
                jQuery('<p><strong> Your key is not found. Please contact support@villatheme.com </strong></p>').insertAfter(".villatheme-autoupdate-key-field");
            }
        });
    });
    /**
     * End get download key
     */
    $('.woo-orders-tracking-button-save-settings-container').closest('form').on('submit', function () {
        $('.woo-orders-tracking-ft-message-order-statuses').map(function () {
            let $order_statuses = $(this).find('select').eq(0);
            $order_statuses.closest('td').find('.woo-orders-tracking-ft-message-order-statuses-value').val(JSON.stringify($order_statuses.val()));
        });
        $('.woo-orders-tracking-button-save-settings-container').find('button[type="submit"]').addClass('loading');
    });
    /*Add row*/
    $('.woo-orders-tracking-ft-button-add').on('click', function () {
        let $rows = $('.woo-orders-tracking-ft-row'),
            $lastRow = $rows.last(),
            $newRow = $lastRow.clone();
        $newRow.find('.vi-ui.dropdown').dropdown();
        $('.woo-orders-tracking-default-track-info-table tbody').append($newRow);
        ft_recalculate_row_no();
    });

    /*remove row*/
    $(document).on('click', '.woo-orders-tracking-ft-button-remove', function () {
        let $button = $(this), $rows = $('.woo-orders-tracking-ft-row'),
            $row = $button.closest('.woo-orders-tracking-ft-row');
        if ($rows.length > 1) {
            if (confirm(vi_wot_admin_settings.i18n_remove_row_confirm)) {
                $row.fadeOut(300);
                setTimeout(function () {
                    $row.remove();
                    ft_recalculate_row_no();
                }, 300);
            }
        } else {
            $row.find('input[type="number"]').val(0);
            $row.find('input[type="text"]').val('');
        }
    });

    function ft_recalculate_row_no() {
        let row_no = 1;
        $('.woo-orders-tracking-ft-message-no').map(function () {
            $(this).html(row_no++);
        })
    }

    /*Add new or choose from tracking service carriers*/
    $('#add-new-shipping-carrier-html-content-body-add-carrier-type').on('change', function () {
        let $select = $(this), $container = $select.closest('.add-new-shipping-carrier-html-content-body');
        $container.find('input[type="text"]').val('');
        if ($select.val() === 'new') {
            $container.find('input[type="text"]').attr('readonly', false);
            $container.find('input[type="checkbox"]').attr('disabled', false);
            $container.find('select.add-new-shipping-carrier-html-content-body-country').attr('disabled', false).val('Global').trigger('change');
            $('.add-new-shipping-carrier-html-content-body-choose-from-wrap').addClass('woo-orders-tracking-hidden');
        } else {
            $container.find('#add-new-shipping-carrier-html-content-body-carrier-name').attr('readonly', 'readonly');
            $container.find('input[type="checkbox"]').attr('disabled', 'disabled').prop('checked', false);
            $('.add-new-shipping-carrier-html-content-body-choose-from-wrap').not(`.add-new-shipping-carrier-html-content-body-choose-from-${$select.val()}-wrap`).addClass('woo-orders-tracking-hidden');
            $(`.add-new-shipping-carrier-html-content-body-choose-from-${$select.val()}-wrap`).removeClass('woo-orders-tracking-hidden');
            $(`#add-new-shipping-carrier-html-content-body-choose-from-${$select.val()}`).trigger('change');
        }
    }).trigger('change');

    /*Select a trackingmore carrier*/
    $('#add-new-shipping-carrier-html-content-body-choose-from-trackingmore').on('change', function () {
        let $select = $(this),
            carrier_slug = $select.val();
        if (carrier_slug) {
            for (let i = 0; i < trackingmore_carriers.length; i++) {
                if (trackingmore_carriers[i]['code'] === carrier_slug) {
                    $('#add-new-shipping-carrier-html-content-body-carrier-name').val(trackingmore_carriers[i]['name']);
                    $('#add-new-shipping-carrier-html-content-body-carrier-display-name').val(trackingmore_carriers[i]['name']);
                    $('#add-new-shipping-carrier-html-content-body-carrier-slug').val('');
                    $('#add-new-shipping-carrier-html-content-body-carrier-url').val(trackingmore_carriers[i]['track_url'] ? trackingmore_carriers[i]['track_url'].replace('******', '{tracking_number}') : trackingmore_carriers[i]['homepage']);
                    $('#add-new-shipping-carrier-html-content-body-country').val(trackingmore_carriers[i]['country_code'] ? trackingmore_carriers[i]['country_code'] : 'Global').trigger('change');
                    break;
                }
            }
        }
    });

    /*Select a 17track carrier*/
    $('#add-new-shipping-carrier-html-content-body-choose-from-17track').on('change', function () {
        let $select = $(this),
            carrier_slug = $select.val();
        if (carrier_slug) {
            for (let i = 0; i < _17track_carriers.length; i++) {
                if (_17track_carriers[i]['key'] == carrier_slug) {
                    $('#add-new-shipping-carrier-html-content-body-carrier-name').val(_17track_carriers[i]['_name']);
                    $('#add-new-shipping-carrier-html-content-body-carrier-display-name').val(_17track_carriers[i]['_name']);
                    $('#add-new-shipping-carrier-html-content-body-carrier-slug').val('');
                    $('#add-new-shipping-carrier-html-content-body-carrier-url').val(_17track_carriers[i]['_url']);
                    $('#add-new-shipping-carrier-html-content-body-country').val('Global').trigger('change');
                    break;
                }
            }
        }
    });
    $('#add-new-shipping-carrier-html-content-body-choose-from-tracktry').on('change', function () {
        let $select = $(this),
            carrier_slug = $select.val();
        if (carrier_slug) {
            for (let i = 0; i < tracktry_carriers.length; i++) {
                if (tracktry_carriers[i]['code'] == carrier_slug) {
                    $('#add-new-shipping-carrier-html-content-body-carrier-name').val(tracktry_carriers[i]['name']);
                    $('#add-new-shipping-carrier-html-content-body-carrier-display-name').val(tracktry_carriers[i]['name']);
                    $('#add-new-shipping-carrier-html-content-body-carrier-slug').val('');
                    $('#add-new-shipping-carrier-html-content-body-carrier-url').val(tracktry_carriers[i]['homepage']);
                    $('#add-new-shipping-carrier-html-content-body-country').val('Global').trigger('change');
                    break;
                }
            }
        }
    });
    $('select[name="woo-orders-tracking-settings[manage_tracking]"]').on('change', function () {
        let $track_per_quantity_row = $('[name="woo-orders-tracking-settings[track_per_quantity]"]').closest('tr');
        if ($(this).val() === 'order_only') {
            $track_per_quantity_row.fadeOut(300);
        } else {
            $track_per_quantity_row.fadeIn(300);
        }
    }).trigger('change');
    $('select[name="woo-orders-tracking-settings[track_per_quantity]"]').on('change', function () {
        switch ($(this).val()){
            case '1':
                $('.woo-orders-tracking-track_per_quantity-enable').fadeIn(300);
                $('.woo-orders-tracking-multi_track_per_item-enable').fadeOut(300);
                break;
            case 'unlimited':
                $('.woo-orders-tracking-track_per_quantity-enable').fadeOut(300);
                $('.woo-orders-tracking-multi_track_per_item-enable').fadeIn(300);
                break;
            default:
                $('.woo-orders-tracking-track_per_quantity-enable').fadeOut(300);
                $('.woo-orders-tracking-multi_track_per_item-enable').fadeOut(300);
        }
    }).trigger('change');
    // map carrier - Integration
    $(document).on('click','.vi-wot-remove-carrier', function () {
        if (confirm('Are you sure to remove this item?')){
            $(this).closest('tr').remove();
            let $mapping = $(this).closest('.vi-wot-carriers-mapping');
            let integration_name = $mapping.data('integration_name');
            $('.vi-wot-carrier-mapping input[type=text]').each(function (k,v) {
                $(this).attr('name',integration_name+'['+k+'][name]');
            });
            $('.vi-wot-carrier-mapping select').each(function (k,v) {
                $(this).attr('name',integration_name+'['+k+'][map]');
            });
        }
    });
    $(document).on('click','.vi-wot-add-carrier', function () {
        let $mapping = $(this).closest('[data-tab="integration"]').find('.vi-wot-carriers-mapping');
        let integration = $mapping.data('integration'),
            integration_name = $mapping.data('integration_name');
        let index = $('.vi-wot-carrier-mapping').length;
        let html = `<tr class="vi-wot-${integration}-carrier-mapping vi-wot-carrier-mapping">`;
        html +=`<td><input type="text" name="${integration_name}[${index}][name]" value=""></td>`;
        html +=`<td><select class="vi-ui fluid search dropdown vi-wot-${integration}-mapping-carrier vi-wot-mapping-carrier" name="${integration_name}[${index}][map]"><option value=""></option>`;
        for (let carrier of vi_wot_admin_settings.carriers) {
            html +=`<option value="${carrier['slug']}">${carrier['name']}</option>`;
        }
        html +=`</select></td><td><i class="icon trash alternate outline vi-wot-${integration}-remove-carrier vi-wot-remove-carrier"></i></td></tr>`;
        $mapping.find('tbody').append(html);
        $mapping.find('select.vi-ui.dropdown').dropdown();
    });

    //ShipStation
    $(document).on('click','.vi-wot-shipstation-remove-carrier', function () {
        if (confirm('Are you sure to remove this item?')){
            $(this).closest('tr').remove();
            $('.vi-wot-shipstation-carrie-mapping input[type=text]').each(function (k,v) {
                $(this).attr('name','shipstation_courier_mapping['+k+'][name]');
            });
            $('.vi-wot-shipstation-carrie-mapping select').each(function (k,v) {
                $(this).attr('name','shipstation_courier_mapping['+k+'][map]');
            });
        }
    });
    $(document).on('click','.vi-wot-shipstation-add-carrier', function () {
        let index = $('.vi-wot-shipstation-carrie-mapping').length;
        let html = '<tr class="vi-wot-shipstation-carrie-mapping">';
        html +='<td><input type="text" name="shipstation_courier_mapping['+index+'][name]" value=""></td>';
        html +='<td><select class="vi-ui fluid search dropdown vi-wot-shipstation-mapping-carrier" name="shipstation_courier_mapping['+index+'][map]"><option value=""></option>';
        for (let carrier of vi_wot_admin_settings.carriers) {
            html +=`<option value="${carrier['slug']}">${carrier['name']}</option>`;
        }
        html +='</select></td><td><i class="icon trash alternate outline vi-wot-shipstation-remove-carrier"></i></td></tr>';
        $('.vi-wot-shipstation-carriers-mapping tbody').append(html);
        $('.vi-wot-shipstation-carriers-mapping select.vi-ui.dropdown').dropdown();
    });
});