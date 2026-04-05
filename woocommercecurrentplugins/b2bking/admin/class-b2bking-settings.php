<?php

/**
*
* PHP File that handles Settings management
*
*/

class B2bking_Settings {

	public function register_all_settings() {

		// Set plugin status (Disabled, B2B & B2C, or B2B)
		register_setting('b2bking', 'b2bking_plugin_status_setting');

		// Request a Custom Quote Button
		register_setting('b2bking', 'b2bking_quote_button_cart_setting');

		// Current Tab Setting - Misc setting, hidden, only saves the last opened menu tab
		register_setting( 'b2bking', 'b2bking_current_tab_setting');
		add_settings_field('b2bking_current_tab_setting', '', array($this, 'b2bking_current_tab_setting_content'), 'b2bking', 'b2bking_hiddensettings');


		/* WCFM ADDON */
	    add_settings_section('b2bking_wcfmsettings_section', '',	'',	'b2bking');


		// Show dynamic rules to vendors
		register_setting( 'b2bking', 'b2bking_show_dynamic_rules_vendors_setting_wcfm');
		add_settings_field('b2bking_show_dynamic_rules_vendors_setting_wcfm', esc_html__('Show dynamic rules to vendors', 'b2bkingwcfm'), array($this, 'b2bking_show_dynamic_rules_vendors_setting_wcfm_content'), 'b2bking', 'b2bking_wcfmsettings_section');

	    // Show visibility to vendors
	    register_setting('b2bking', 'b2bking_show_visibility_vendors_setting_wcfm');
	    add_settings_field('b2bking_show_visibility_vendors_setting_wcfm', esc_html__('Allow vendors to set product visibility', 'b2bkingwcfm'), array($this,'b2bking_show_visibility_vendors_setting_wcfm_content'), 'b2bking', 'b2bking_wcfmsettings_section');

		/* MarketKing ADDON */
	    add_settings_section('b2bking_marketkingsettings_section', '',	'',	'b2bking');

		// Show dynamic rules to vendors
		register_setting( 'b2bking', 'b2bking_show_dynamic_rules_vendors_setting_marketking');
		add_settings_field('b2bking_show_dynamic_rules_vendors_setting_marketking', esc_html__('Show dynamic rules to vendors', 'b2bkingmarketking'), array($this, 'b2bking_show_dynamic_rules_vendors_setting_marketking_content'), 'b2bking', 'b2bking_marketkingsettings_section');

	    // Show visibility to vendors
	    register_setting('b2bking', 'b2bking_show_visibility_vendors_setting_marketking');
	    add_settings_field('b2bking_show_visibility_vendors_setting_marketking', esc_html__('Allow vendors to set product visibility', 'b2bkingmarketking'), array($this,'b2bking_show_visibility_vendors_setting_marketking_content'), 'b2bking', 'b2bking_marketkingsettings_section');


		/* Access restriction */

		// Set guest access restriction (none, hide prices, hide website, replace with request quote)
		register_setting('b2bking', 'b2bking_guest_access_restriction_setting');

		add_settings_section('b2bking_access_restriction_settings_section', '',	'',	'b2bking');
		add_settings_section('b2bking_access_restriction_settings_force_section', '',	'',	'b2bking');


		// All products visible to all users
		register_setting('b2bking', 'b2bking_all_products_visible_all_users_setting');
		add_settings_field('b2bking_all_products_visible_all_users_setting', $this->b2bking_all_products_visible_all_users_setting_description(), array($this,'b2bking_all_products_visible_all_users_setting_content'), 'b2bking', 'b2bking_access_restriction_settings_section');

		register_setting('b2bking', 'b2bking_guest_access_restriction_setting_website_redirect');
		add_settings_field('b2bking_guest_access_restriction_setting_website_redirect', $this->b2bking_guest_access_restriction_setting_website_redirect_description(), array($this,'b2bking_guest_access_restriction_setting_website_redirect_content'), 'b2bking', 'b2bking_access_restriction_settings_force_section');
		

		// set categories to visible by default when "control visibility" is set
		add_action('update_option_b2bking_all_products_visible_all_users_setting', array($this, 'b2bking_check_visibility_setting_change'), 10, 3);
		add_action('update_option_b2bking_offer_one_per_user_setting', array($this, 'b2bking_set_offer_sold_individually'), 10, 3);

		add_settings_section('b2bking_access_restriction_category_settings_section', '',	'',	'b2bking');
		// Enable rules for non b2b users
		register_setting('b2bking', 'b2bking_hidden_has_priority_setting');
		add_settings_field('b2bking_hidden_has_priority_setting', $this->b2bking_hidden_has_priority_setting_description(), array($this,'b2bking_hidden_has_priority_setting_content'), 'b2bking', 'b2bking_access_restriction_category_settings_section');		

		/* Registration Settings */
		add_settings_section('b2bking_registration_settings_section', '',	'',	'b2bking');
		add_settings_section('b2bking_registration_settings_section_advanced', '',	'',	'b2bking');

		// Registration Role Dropdown enable (enabled by default)
		register_setting('b2bking', 'b2bking_registration_roles_dropdown_setting');
		add_settings_field('b2bking_registration_roles_dropdown_setting', $this->b2bking_registration_roles_dropdown_setting_description(), array($this,'b2bking_registration_roles_dropdown_setting_content'), 'b2bking', 'b2bking_registration_settings_section');
		
		// Enable custom registration in checkout 
		register_setting('b2bking', 'b2bking_registration_at_checkout_setting');
		add_settings_field('b2bking_registration_at_checkout_setting', $this->b2bking_registration_at_checkout_setting_description(), array($this,'b2bking_registration_at_checkout_setting_content'), 'b2bking', 'b2bking_registration_settings_section_advanced');

		// allow loggedin
		register_setting('b2bking', 'b2bking_registration_loggedin_setting');
		add_settings_field('b2bking_registration_loggedin_setting', $this->b2bking_registration_loggedin_setting_description(), array($this,'b2bking_registration_loggedin_setting_content'), 'b2bking', 'b2bking_registration_settings_section_advanced');

		// Require approval for all users' registration
		register_setting('b2bking', 'b2bking_approval_required_all_users_setting');
		add_settings_field('b2bking_approval_required_all_users_setting', $this->b2bking_approval_required_all_users_setting_description(), array($this,'b2bking_approval_required_all_users_setting_content'), 'b2bking', 'b2bking_registration_settings_section_advanced');


		// Separate my account page for b2b users
		register_setting('b2bking', 'b2bking_registration_separate_my_account_page_setting');
		add_settings_field('b2bking_registration_separate_my_account_page_setting', $this->b2bking_registration_separate_my_account_page_setting_description(), array($this,'b2bking_registration_separate_my_account_page_setting_content'), 'b2bking', 'b2bking_registration_settings_section_advanced');


		// Enable Validate VAT button at checkout
		register_setting('b2bking', 'b2bking_validate_vat_button_checkout_setting');
		add_settings_field('b2bking_validate_vat_button_checkout_setting', $this->b2bking_validate_vat_button_checkout_setting_description(), array($this,'b2bking_validate_vat_button_checkout_setting_content'), 'b2bking', 'b2bking_othersettings_vat_section');


		/* Offers Settings */
		add_settings_section('b2bking_offers_settings_section', '',	'',	'b2bking');
		// Show product selector in Offers
		register_setting('b2bking', 'b2bking_offers_product_selector_setting');
		add_settings_field('b2bking_offers_product_selector_setting', $this->b2bking_offers_product_selector_setting_description(), array($this,'b2bking_offers_product_selector_setting_content'), 'b2bking', 'b2bking_offers_settings_section');
		// Show product selector in Offers
		register_setting('b2bking', 'b2bking_offers_product_image_setting');
		add_settings_field('b2bking_offers_product_image_setting', $this->b2bking_offers_product_image_setting_description(), array($this,'b2bking_offers_product_image_setting_content'), 'b2bking', 'b2bking_offers_settings_section');
		// 1 offer per use
		register_setting('b2bking', 'b2bking_offer_one_per_user_setting');
		add_settings_field('b2bking_offer_one_per_user_setting', $this->b2bking_offer_one_per_user_setting_description(), array($this,'b2bking_offer_one_per_user_setting_content'), 'b2bking', 'b2bking_offers_settings_section');

		// use actual products
		register_setting('b2bking', 'b2bking_offer_use_products_setting');
		add_settings_field('b2bking_offer_use_products_setting', $this->b2bking_offer_use_products_setting_description(), array($this,'b2bking_offer_use_products_setting_content'), 'b2bking', 'b2bking_offers_settings_section');
		// Logo Upload
		register_setting( 'b2bking', 'b2bking_offers_logo_setting');
		add_settings_field('b2bking_offers_logo_setting', $this->b2bking_offers_logo_setting_description(), array($this,'b2bking_offers_logo_setting_content'), 'b2bking', 'b2bking_offers_settings_section');		
		// Offer IMG
		register_setting( 'b2bking', 'b2bking_offers_image_setting');
		add_settings_field('b2bking_offers_image_setting', $this->b2bking_offers_image_setting_description(), array($this,'b2bking_offers_image_setting_content'), 'b2bking', 'b2bking_offers_settings_section');

		/* Enable Features */

		add_settings_section('b2bking_enable_features_settings_section', '',	'',	'b2bking');

		// Enable conversations
		register_setting('b2bking', 'b2bking_enable_conversations_setting');
		add_settings_field('b2bking_enable_conversations_setting', esc_html__('Enable conversations & quote requests', 'b2bking'), array($this,'b2bking_enable_conversations_setting_content'), 'b2bking', 'b2bking_enable_features_settings_section');

		// Enable offers
		register_setting('b2bking', 'b2bking_enable_offers_setting');
		add_settings_field('b2bking_enable_offers_setting', esc_html__('Enable offers', 'b2bking'), array($this,'b2bking_enable_offers_setting_content'), 'b2bking', 'b2bking_enable_features_settings_section');

		// Enable purchase lists
		register_setting('b2bking', 'b2bking_enable_purchase_lists_setting');
		add_settings_field('b2bking_enable_purchase_lists_setting', esc_html__('Enable purchase lists', 'b2bking'), array($this,'b2bking_enable_purchase_lists_setting_content'), 'b2bking', 'b2bking_enable_features_settings_section');

		// Enable bulk order form
		register_setting('b2bking', 'b2bking_enable_bulk_order_form_setting');
		add_settings_field('b2bking_enable_bulk_order_form_setting', esc_html__('Enable bulk order form', 'b2bking'), array($this,'b2bking_enable_bulk_order_form_setting_content'), 'b2bking', 'b2bking_enable_features_settings_section');

		// Enable subaccounts
		register_setting('b2bking', 'b2bking_enable_subaccounts_setting');
		add_settings_field('b2bking_enable_subaccounts_setting', esc_html__('Enable subaccounts', 'b2bking'), array($this,'b2bking_enable_subaccounts_setting_content'), 'b2bking', 'b2bking_enable_features_settings_section');

		// Quotes section
		add_settings_section('b2bking_quotes_settings_section', '',	'',	'b2bking');
		// Show product selector in Offers
		register_setting('b2bking', 'b2bking_hide_prices_quote_only_setting');
		add_settings_field('b2bking_hide_prices_quote_only_setting', $this->b2bking_hide_prices_quote_only_setting_description(), array($this,'b2bking_hide_prices_quote_only_setting_content'), 'b2bking', 'b2bking_quotes_settings_section');


		/* License Settings */
		add_settings_section('b2bking_license_settings_section', '',	'',	'b2bking');
		// Hide prices to guests text

		// only show details if license is not active
		$license = get_option('b2bking_license_key_setting', '');
		$email = get_option('b2bking_license_email_setting', '');
		$info = parse_url(get_site_url());
		$host = $info['host'];
		$host_names = explode(".", $host);

		if (isset($host_names[count($host_names)-2])){ // e.g. if not on localhost, xampp etc
		    $bottom_host_name = $host_names[count($host_names)-2] . "." . $host_names[count($host_names)-1];

		    if (strlen($host_names[count($host_names)-2]) <= 3){    // likely .com.au, .co.uk, .org.uk etc
		        if (isset($host_names[count($host_names)-3])){
		            $bottom_host_name_new = $host_names[count($host_names)-3] . "." . $host_names[count($host_names)-2] . "." . $host_names[count($host_names)-1];
		            $bottom_host_name = $bottom_host_name_new;
		        }
		    }

		    $activation = get_option('pluginactivation_'.$email.'_'.$license.'_'.$bottom_host_name);

		    if ($activation !== 'active'){
				register_setting('b2bking', 'b2bking_license_email_setting');
				add_settings_field('b2bking_license_email_setting', esc_html__('License Email', 'b2bking'), array($this,'b2bking_license_email_setting_content'), 'b2bking', 'b2bking_license_settings_section');

				register_setting('b2bking', 'b2bking_license_key_setting');
				add_settings_field('b2bking_license_key_setting', esc_html__('License Key', 'b2bking'), array($this,'b2bking_license_key_setting_content'), 'b2bking', 'b2bking_license_settings_section');
			}
		}

		/* Language Settings */

		add_settings_section('b2bking_languagesettings_text_section', '',	'',	'b2bking');

		// Hide prices to guests text
		register_setting('b2bking', 'b2bking_hide_prices_guests_text_setting');
		add_settings_field('b2bking_hide_prices_guests_text_setting', $this->b2bking_hide_prices_guests_text_setting_description(), array($this,'b2bking_hide_prices_guests_text_setting_content'), 'b2bking', 'b2bking_languagesettings_text_section');

		// Hide b2b site entirely text
		register_setting('b2bking', 'b2bking_hide_b2b_site_text_setting');
		add_settings_field('b2bking_hide_b2b_site_text_setting', $this->b2bking_hide_b2b_site_text_setting_description(), array($this,'b2bking_hide_b2b_site_text_setting_content'), 'b2bking', 'b2bking_languagesettings_text_section');

		// Hidden price dynamic rule text
		register_setting('b2bking', 'b2bking_hidden_price_dynamic_rule_text_setting');
		add_settings_field('b2bking_hidden_price_dynamic_rule_text_setting', $this->b2bking_hidden_price_dynamic_rule_text_setting_description(), array($this,'b2bking_hidden_price_dynamic_rule_text_setting_content'), 'b2bking', 'b2bking_languagesettings_text_section');

		// Hide prices to guests text
		register_setting('b2bking', 'b2bking_retail_price_text_setting');
		add_settings_field('b2bking_retail_price_text_setting', $this->b2bking_retail_price_text_setting_description(), array($this,'b2bking_retail_price_text_setting_content'), 'b2bking', 'b2bking_languagesettings_text_section');

		// Hide prices to guests text
		register_setting('b2bking', 'b2bking_wholesale_price_text_setting');
		add_settings_field('b2bking_wholesale_price_text_setting', $this->b2bking_wholesale_price_text_setting_description(), array($this,'b2bking_wholesale_price_text_setting_content'), 'b2bking', 'b2bking_languagesettings_text_section');

		// inc and ex vat
		register_setting('b2bking', 'b2bking_inc_vat_text_setting');
		add_settings_field('b2bking_inc_vat_text_setting', $this->b2bking_inc_vat_text_setting_description(), array($this,'b2bking_inc_vat_text_setting_content'), 'b2bking', 'b2bking_languagesettings_text_section');

		// inc and ex vat
		register_setting('b2bking', 'b2bking_ex_vat_text_setting');
		add_settings_field('b2bking_ex_vat_text_setting', $this->b2bking_ex_vat_text_setting_description(), array($this,'b2bking_ex_vat_text_setting_content'), 'b2bking', 'b2bking_languagesettings_text_section');


		add_settings_section('b2bking_languagesettings_purchaselists_section', '',	'',	'b2bking');

		// Purchase Lists Language
		register_setting('b2bking', 'b2bking_purchase_lists_language_setting');
		add_settings_field('b2bking_purchase_lists_language_setting', $this->b2bking_purchase_lists_language_setting_description(), array($this,'b2bking_purchase_lists_language_setting_content'), 'b2bking', 'b2bking_languagesettings_purchaselists_section');

		/* Performance Settings */

		add_settings_section('b2bking_performance_settings_section', '',	'',	'b2bking');

		register_setting('b2bking', 'b2bking_disable_visibility_setting');

		register_setting('b2bking', 'b2bking_disable_registration_setting');
		add_settings_field('b2bking_disable_registration_setting', esc_html__('Disable registration & custom fields', 'b2bking'), array($this,'b2bking_disable_registration_setting_content'), 'b2bking', 'b2bking_performance_settings_section');

		register_setting('b2bking', 'b2bking_disable_registration_scripts_setting');
		add_settings_field('b2bking_disable_registration_scripts_setting', esc_html__('Disable frontend registration scripts', 'b2bking'), array($this,'b2bking_disable_registration_scripts_setting_content'), 'b2bking', 'b2bking_performance_settings_section');

		register_setting('b2bking', 'b2bking_disable_shipping_control_setting');
		add_settings_field('b2bking_disable_shipping_control_setting', esc_html__('Disable shipping methods control', 'b2bking'), array($this,'b2bking_disable_shipping_control_setting_content'), 'b2bking', 'b2bking_performance_settings_section');

		register_setting('b2bking', 'b2bking_disable_payment_control_setting');
		add_settings_field('b2bking_disable_payment_control_setting', esc_html__('Disable payment methods control', 'b2bking'), array($this,'b2bking_disable_payment_control_setting_content'), 'b2bking', 'b2bking_performance_settings_section');

		register_setting('b2bking', 'b2bking_disable_group_tiered_pricing_setting');
		add_settings_field('b2bking_disable_group_tiered_pricing_setting', esc_html__('Disable group & tiered pricing', 'b2bking'), array($this,'b2bking_disable_group_tiered_pricing_setting_content'), 'b2bking', 'b2bking_performance_settings_section');

		register_setting('b2bking', 'b2bking_disable_product_level_minmaxstep_setting');
		add_settings_field('b2bking_disable_product_level_minmaxstep_setting', esc_html__('Disable min / max / step on product page', 'b2bking'), array($this,'b2bking_disable_product_level_minmaxstep_setting_content'), 'b2bking', 'b2bking_performance_settings_section');

		register_setting('b2bking', 'b2bking_disble_coupon_for_b2b_values_setting');
		add_settings_field('b2bking_disble_coupon_for_b2b_values_setting', esc_html__('Disable coupon value features (may help fix conflicts with coupon plugins)', 'b2bking'), array($this,'b2bking_disble_coupon_for_b2b_values_setting_content'), 'b2bking', 'b2bking_performance_settings_section');
		
		register_setting('b2bking', 'b2bking_disable_dynamic_rule_discount_setting');
		add_settings_field('b2bking_disable_dynamic_rule_discount_setting', esc_html__('Disable dynamic rule discounts', 'b2bking'), array($this,'b2bking_disable_dynamic_rule_discount_setting_content'), 'b2bking', 'b2bking_performance_settings_section');
		register_setting('b2bking', 'b2bking_disable_dynamic_rule_discount_sale_setting');
		add_settings_field('b2bking_disable_dynamic_rule_discount_sale_setting', esc_html__('Disable dynamic rule discounts as sale price', 'b2bking'), array($this,'b2bking_disable_dynamic_rule_discount_sale_setting_content'), 'b2bking', 'b2bking_performance_settings_section');
		register_setting('b2bking', 'b2bking_disable_dynamic_rule_fixedprice_setting');
		add_settings_field('b2bking_disable_dynamic_rule_fixedprice_setting', esc_html__('Disable dynamic rule fixed price', 'b2bking'), array($this,'b2bking_disable_dynamic_rule_fixedprice_setting_content'), 'b2bking', 'b2bking_performance_settings_section');
		register_setting('b2bking', 'b2bking_disable_dynamic_rule_hiddenprice_setting');
		add_settings_field('b2bking_disable_dynamic_rule_hiddenprice_setting', esc_html__('Disable dynamic rule hidden price', 'b2bking'), array($this,'b2bking_disable_dynamic_rule_hiddenprice_setting_content'), 'b2bking', 'b2bking_performance_settings_section');

		register_setting('b2bking', 'b2bking_disable_dynamic_rule_addtax_setting');
		add_settings_field('b2bking_disable_dynamic_rule_addtax_setting', esc_html__('Disable dynamic rule add tax/fee', 'b2bking'), array($this,'b2bking_disable_dynamic_rule_addtax_setting_content'), 'b2bking', 'b2bking_performance_settings_section');

		register_setting('b2bking', 'b2bking_disable_dynamic_rule_freeshipping_setting');
		add_settings_field('b2bking_disable_dynamic_rule_freeshipping_setting', esc_html__('Disable dynamic rule free shipping', 'b2bking'), array($this,'b2bking_disable_dynamic_rule_freeshipping_setting_content'), 'b2bking', 'b2bking_performance_settings_section');
		register_setting('b2bking', 'b2bking_disable_dynamic_rule_minmax_setting');
		add_settings_field('b2bking_disable_dynamic_rule_minmax_setting', esc_html__('Disable dynamic rule minimum and maximum order', 'b2bking'), array($this,'b2bking_disable_dynamic_rule_minmax_setting_content'), 'b2bking', 'b2bking_performance_settings_section');


		register_setting('b2bking', 'b2bking_disable_dynamic_rule_requiredmultiple_setting');
		add_settings_field('b2bking_disable_dynamic_rule_requiredmultiple_setting', esc_html__('Disable dynamic rule required multiple', 'b2bking'), array($this,'b2bking_disable_dynamic_rule_requiredmultiple_setting_content'), 'b2bking', 'b2bking_performance_settings_section');

		register_setting('b2bking', 'b2bking_disable_dynamic_rule_zerotax_setting');
		add_settings_field('b2bking_disable_dynamic_rule_zerotax_setting', esc_html__('Disable dynamic rule zero tax', 'b2bking'), array($this,'b2bking_disable_dynamic_rule_zerotax_setting_content'), 'b2bking', 'b2bking_performance_settings_section');

		register_setting('b2bking', 'b2bking_disable_dynamic_rule_taxexemption_setting');
		add_settings_field('b2bking_disable_dynamic_rule_taxexemption_setting', esc_html__('Disable dynamic rule tax exemption', 'b2bking'), array($this,'b2bking_disable_dynamic_rule_taxexemption_setting_content'), 'b2bking', 'b2bking_performance_settings_section');

		

		/* Other Settings */

		add_settings_section('b2bking_othersettings_section', '',	'',	'b2bking');

		// Keep data on uninstall 
	//	register_setting('b2bking', 'b2bking_keepdata_setting');
	//	add_settings_field('b2bking_keepdata_setting', esc_html__('Keep data on uninstall:', 'b2bking'), array($this,'b2bking_keepdata_setting_content'), 'b2bking', 'b2bking_othersettings_section');


		add_settings_section('b2bking_othersettings_multisite_section', '',	'',	'b2bking');

		// Multisite setting
		register_setting('b2bking', 'b2bking_multisite_separate_b2bb2c_setting');
		add_settings_field('b2bking_multisite_separate_b2bb2c_setting', $this->b2bking_multisite_separate_b2bb2c_setting_description(), array($this,'b2bking_multisite_separate_b2bb2c_setting_content'), 'b2bking', 'b2bking_othersettings_multisite_section');

		add_settings_section('b2bking_othersettings_bulkorderform_section', '',	'',	'b2bking');

		// Order Form Theme
		register_setting('b2bking', 'b2bking_order_form_theme_setting');
		add_settings_field('b2bking_order_form_theme_setting', $this->b2bking_order_form_theme_setting_description(), array($this,'b2bking_order_form_theme_setting_content'), 'b2bking', 'b2bking_othersettings_bulkorderform_section_theme');

		register_setting('b2bking', 'b2bking_order_form_creme_cart_button_setting');
		add_settings_field('b2bking_order_form_creme_cart_button_setting', $this->b2bking_order_form_creme_cart_button_setting_description(), array($this,'b2bking_order_form_creme_cart_button_setting_content'), 'b2bking', 'b2bking_othersettings_bulkorderform_section_theme');

		// Order Form Theme
		register_setting('b2bking', 'b2bking_order_form_sortby_setting');
		add_settings_field('b2bking_order_form_sortby_setting', $this->b2bking_order_form_sortby_setting_description(),
			array($this,'b2bking_order_form_sortby_setting_content'), 'b2bking', 'b2bking_othersettings_bulkorderform_section_theme');

		// Enable Multi-Select
		register_setting('b2bking', 'b2bking_order_form_cream_multiselect_setting');
		add_settings_field('b2bking_order_form_cream_multiselect_setting', $this->b2bking_order_form_cream_multiselect_setting_description(), array($this,'b2bking_order_form_cream_multiselect_setting_content'), 'b2bking', 'b2bking_othersettings_bulkorderform_section_theme');

		// Search by SKU setting
		register_setting('b2bking', 'b2bking_search_by_sku_setting');
		add_settings_field('b2bking_search_by_sku_setting', $this->b2bking_search_by_sku_setting_description(), array($this,'b2bking_search_by_sku_setting_content'), 'b2bking', 'b2bking_othersettings_bulkorderform_section_search');

		// Search by Description setting
		register_setting('b2bking', 'b2bking_search_product_description_setting');
		add_settings_field('b2bking_search_product_description_setting', $this->b2bking_search_product_description_setting_description(), array($this,'b2bking_search_product_description_setting_content'), 'b2bking', 'b2bking_othersettings_bulkorderform_section_search');

		// Search each individual variation setting
		register_setting('b2bking', 'b2bking_search_each_variation_setting');
		add_settings_field('b2bking_search_each_variation_setting', $this->b2bking_search_each_variation_setting_description(), array($this,'b2bking_search_each_variation_setting_content'), 'b2bking', 'b2bking_othersettings_bulkorderform_section_search');

		// Show accounting subtotals
		register_setting('b2bking', 'b2bking_show_accounting_subtotals_setting');
		add_settings_field('b2bking_show_accounting_subtotals_setting', $this->b2bking_show_accounting_subtotals_setting_description(), array($this,'b2bking_show_accounting_subtotals_setting_content'), 'b2bking', 'b2bking_othersettings_bulkorderform_section_search');

		// Show images in bulk order form
		register_setting('b2bking', 'b2bking_show_images_bulk_order_form_setting');
		add_settings_field('b2bking_show_images_bulk_order_form_setting', $this->b2bking_show_images_bulk_order_form_setting_description(), array($this,'b2bking_show_images_bulk_order_form_setting_content'), 'b2bking', 'b2bking_othersettings_bulkorderform_section_theme');

		// PRICE and PRODUCT DISPLAY SETTINGS START

		add_settings_section('b2bking_othersettings_priceproductdisplay_section', '',	'',	'b2bking');

		register_setting('b2bking', 'b2bking_show_moq_product_page_setting');
		add_settings_field('b2bking_show_moq_product_page_setting', $this->b2bking_show_moq_product_page_setting_description(), array($this,'b2bking_show_moq_product_page_setting_content'), 'b2bking', 'b2bking_othersettings_priceproductdisplay_section');

		register_setting('b2bking', 'b2bking_show_b2c_price_setting');
		add_settings_field('b2bking_show_b2c_price_setting', $this->b2bking_show_b2c_price_setting_description(), array($this,'b2bking_show_b2c_price_setting_content'), 'b2bking', 'b2bking_othersettings_priceproductdisplay_section');
		
		register_setting('b2bking', 'b2bking_modify_suffix_vat_setting');
		add_settings_field('b2bking_modify_suffix_vat_setting', $this->b2bking_modify_suffix_vat_setting_description(), array($this,'b2bking_modify_suffix_vat_setting_content'), 'b2bking', 'b2bking_othersettings_priceproductdisplay_section');
		// PRICE and PRODUCT DISPLAY SETTINGS END

		// TIEREDPRICING START

		add_settings_section('b2bking_othersettings_tieredpricing_section', '',	'',	'b2bking');
		add_settings_section('b2bking_othersettings_tieredpricing_section_table', '',	'',	'b2bking');

		register_setting('b2bking', 'b2bking_show_discount_in_table_setting');
		add_settings_field('b2bking_show_discount_in_table_setting', $this->b2bking_show_discount_in_table_setting_description(), [$this,'b2bking_show_discount_in_table_setting_toggle'], 'b2bking', 'b2bking_othersettings_tieredpricing_section_table');

		register_setting('b2bking', 'b2bking_color_price_range_setting');
		add_settings_field('b2bking_color_price_range_setting', $this->b2bking_color_price_range_setting_description(), array($this,'b2bking_color_price_range_setting_content'), 'b2bking', 'b2bking_othersettings_tieredpricing_section_table');

		register_setting('b2bking', 'b2bking_table_is_clickable_setting');
		add_settings_field('b2bking_table_is_clickable_setting', $this->b2bking_table_is_clickable_setting_description(), array($this,'b2bking_table_is_clickable_setting_content'), 'b2bking', 'b2bking_othersettings_tieredpricing_section_table');


		register_setting('b2bking', 'b2bking_show_tieredp_product_page_setting');
		add_settings_field('b2bking_show_tieredp_product_page_setting', $this->b2bking_show_tieredp_product_page_setting_description(), array($this,'b2bking_show_tieredp_product_page_setting_content'), 'b2bking', 'b2bking_othersettings_tieredpricing_section');
		// TIEREDPRICING END

		if(apply_filters('b2bking_allow_enter_percentage_setting', true)){
			register_setting('b2bking', 'b2bking_enter_percentage_tiered_setting');
			add_settings_field('b2bking_enter_percentage_tiered_setting', $this->b2bking_enter_percentage_tiered_setting_description(), array($this,'b2bking_enter_percentage_tiered_setting_content'), 'b2bking', 'b2bking_othersettings_tieredpricing_section');
		}
		
		// TIEREDPRICING END

		
		add_settings_section('b2bking_othersettings_permalinks_section', '',	'',	'b2bking');
		// Force permalinks to show
		register_setting('b2bking', 'b2bking_force_permalinks_setting');
		add_settings_field('b2bking_force_permalinks_setting', $this->b2bking_force_permalinks_setting_description(), array($this,'b2bking_force_permalinks_setting_content'), 'b2bking', 'b2bking_othersettings_permalinks_section');

		// Force permalinks to show
		register_setting('b2bking', 'b2bking_force_permalinks_flushing_setting');
		add_settings_field('b2bking_force_permalinks_flushing_setting', esc_html__('Force Permalinks Rewrite', 'b2bking'), array($this,'b2bking_force_permalinks_flushing_setting_content'), 'b2bking', 'b2bking_othersettings_permalinks_hidden_section');
		// hidden section, so that force permalinks is enabled by default with no option to disable via UI

		add_settings_section('b2bking_othersettings_largestores_section', '',	'',	'b2bking');

		register_setting('b2bking', 'b2bking_replace_product_selector_setting');
		add_settings_field('b2bking_replace_product_selector_setting', $this->b2bking_replace_product_selector_setting_description(), array($this,'b2bking_replace_product_selector_setting_content'), 'b2bking', 'b2bking_othersettings_largestores_section');

		register_setting('b2bking', 'b2bking_hide_users_dynamic_rules_setting');
		add_settings_field('b2bking_hide_users_dynamic_rules_setting', $this->b2bking_hide_users_dynamic_rules_setting_description(), array($this,'b2bking_hide_users_dynamic_rules_setting_content'), 'b2bking', 'b2bking_othersettings_largestores_section');

		register_setting('b2bking', 'b2bking_customers_panel_ajax_setting');
		add_settings_field('b2bking_customers_panel_ajax_setting', $this->b2bking_customers_panel_ajax_setting_description(), array($this,'b2bking_customers_panel_ajax_setting_content'), 'b2bking', 'b2bking_othersettings_largestores_section');

		add_settings_section('b2bking_othersettings_caching_section', '',	'',	'b2bking');
		// Search by SKU setting
		register_setting('b2bking', 'b2bking_product_visibility_cache_setting');
		add_settings_field('b2bking_product_visibility_cache_setting', $this->b2bking_product_visibility_cache_setting_description(), array($this,'b2bking_product_visibility_cache_setting_content'), 'b2bking', 'b2bking_othersettings_caching_section');

		add_settings_section('b2bking_othersettings_stock_section', '',	'',	'b2bking');

		register_setting('b2bking', 'b2bking_different_stock_treatment_b2b_setting');
		add_settings_field('b2bking_different_stock_treatment_b2b_setting', esc_html__('Different B2B & B2C stock', 'b2bking'), array($this,'b2bking_different_stock_treatment_b2b_setting_content'), 'b2bking', 'b2bking_othersettings_stock_section');

		register_setting('b2bking', 'b2bking_hide_stock_for_b2c_setting');
		add_settings_field('b2bking_hide_stock_for_b2c_setting', esc_html__('Hide stock for B2C users', 'b2bking'), array($this,'b2bking_hide_stock_for_b2c_setting_content'), 'b2bking', 'b2bking_othersettings_stock_section');

		add_settings_section('b2bking_othersettings_company_section', '',	'',	'b2bking');

		register_setting('b2bking', 'b2bking_enable_company_approval_setting');
		add_settings_field('b2bking_enable_company_approval_setting', $this->b2bking_enable_company_approval_setting_description(), array($this,'b2bking_enable_company_approval_setting_content'), 'b2bking', 'b2bking_othersettings_company_section');

		add_settings_section('b2bking_othersettings_coupons_section', '',	'',	'b2bking');

		register_setting('b2bking', 'b2bking_disable_coupons_b2b_setting');
		add_settings_field('b2bking_disable_coupons_b2b_setting', esc_html__('Disable coupons for B2B', 'b2bking'), array($this,'b2bking_disable_coupons_b2b_setting_content'), 'b2bking', 'b2bking_othersettings_coupons_section');



		add_settings_section('b2bking_othersettings_compatibility_section', '',	'',	'b2bking');
		// Product addon / options compatibility
		register_setting('b2bking', 'b2bking_product_options_compatibility_setting');
		add_settings_field('b2bking_product_options_compatibility_setting', $this->b2bking_product_options_compatibility_setting_description(), array($this,'b2bking_product_options_compatibility_setting_content'), 'b2bking', 'b2bking_othersettings_compatibility_section');

		add_settings_section('b2bking_othersettings_vat_section', '',	'',	'b2bking');
		// Search by SKU setting
		register_setting('b2bking', 'b2bking_vat_exemption_different_country_setting');
		add_settings_field('b2bking_vat_exemption_different_country_setting', $this->b2bking_vat_exemption_different_country_setting_description(), array($this,'b2bking_vat_exemption_different_country_setting_content'), 'b2bking', 'b2bking_othersettings_vat_section');

		// Color and Design
		register_setting('b2bking', 'b2bking_purchase_lists_color_header_setting');
		register_setting('b2bking', 'b2bking_purchase_lists_color_action_buttons_setting');
		register_setting('b2bking', 'b2bking_purchase_lists_color_new_list_setting');

		add_settings_section( 'b2bking_othersettings_colordesign_section', '', '', 'b2bking' );
		register_setting(
			'b2bking',
			'b2bking_color_setting',
			array(
				'sanitize_callback' => function ( $input ) {
					return $input === null ? get_option( 'b2bking_color_setting', '#3AB1E4' ) : $input;
				},
			)
		);
		add_settings_field( 'b2bking_color_setting', esc_html__( 'Frontend Color', 'b2bking' ), array( $this, 'b2bking_color_setting_content' ), 'b2bking', 'b2bking_othersettings_colordesign_section' );

		register_setting(
			'b2bking',
			'b2bking_colorhover_setting',
			array(
				'sanitize_callback' => function ( $input ) {
					return $input === null ? get_option( 'b2bking_colorhover_setting', '#0088c2' ) : $input;
				},
			)
		);
		add_settings_field( 'b2bking_colorhover_setting', esc_html__( 'Frontend Hover Color', 'b2bking' ), array( $this, 'b2bking_colorhover_setting_content' ), 'b2bking', 'b2bking_othersettings_colordesign_section' );

		// Account Endpoints
		add_settings_section( 'b2bking_othersettings_endpoints_section', '', '', 'b2bking' );
		register_setting('b2bking', 'b2bking_conversations_endpoint_setting');
		add_settings_field('b2bking_conversations_endpoint_setting', esc_html__('Conversations endpoint:', 'b2bking'), array($this,'b2bking_conversations_endpoint_setting_content'), 'b2bking', 'b2bking_othersettings_endpoints_section');

		register_setting('b2bking', 'b2bking_conversation_endpoint_setting');
		add_settings_field('b2bking_conversation_endpoint_setting', esc_html__('Conversation endpoint:', 'b2bking'), array($this,'b2bking_conversation_endpoint_setting_content'), 'b2bking', 'b2bking_othersettings_endpoints_section');

		register_setting('b2bking', 'b2bking_offers_endpoint_setting');
		add_settings_field('b2bking_offers_endpoint_setting', esc_html__('Offers endpoint:', 'b2bking'), array($this,'b2bking_offers_endpoint_setting_content'), 'b2bking', 'b2bking_othersettings_endpoints_section');

		register_setting('b2bking', 'b2bking_bulkorder_endpoint_setting');
		add_settings_field('b2bking_bulkorder_endpoint_setting', esc_html__('Bulk Order endpoint:', 'b2bking'), array($this,'b2bking_bulkorder_endpoint_setting_content'), 'b2bking', 'b2bking_othersettings_endpoints_section');

		register_setting('b2bking', 'b2bking_subaccounts_endpoint_setting');
		add_settings_field('b2bking_subaccounts_endpoint_setting', esc_html__('Subaccounts endpoint:', 'b2bking'), array($this,'b2bking_subaccounts_endpoint_setting_content'), 'b2bking', 'b2bking_othersettings_endpoints_section');

		register_setting('b2bking', 'b2bking_subaccount_endpoint_setting');
		add_settings_field('b2bking_subaccount_endpoint_setting', esc_html__('Subaccount endpoint:', 'b2bking'), array($this,'b2bking_subaccount_endpoint_setting_content'), 'b2bking', 'b2bking_othersettings_endpoints_section');

		register_setting('b2bking', 'b2bking_purchaselists_endpoint_setting');
		add_settings_field('b2bking_purchaselists_endpoint_setting', esc_html__('Purchase Lists endpoint:', 'b2bking'), array($this,'b2bking_purchaselists_endpoint_setting_content'), 'b2bking', 'b2bking_othersettings_endpoints_section');

		register_setting('b2bking', 'b2bking_purchaselist_endpoint_setting');
		add_settings_field('b2bking_purchaselist_endpoint_setting', esc_html__('Purchase List endpoint:', 'b2bking'), array($this,'b2bking_purchaselist_endpoint_setting_content'), 'b2bking', 'b2bking_othersettings_endpoints_section');

		if (defined('b2bkingcredit_DIR')){
			register_setting('b2bking', 'b2bking_credit_endpoint_setting');
			add_settings_field('b2bking_credit_endpoint_setting', esc_html__('Company Credit endpoint:', 'b2bking'), array($this,'b2bking_credit_endpoint_setting_content'), 'b2bking', 'b2bking_othersettings_endpoints_section');
		}


		do_action('b2bking_register_settings');

	}

	public function b2bking_color_setting_content() {
		?>
		<input name="b2bking_color_setting" type="color" value="<?php echo esc_attr( get_option( 'b2bking_color_setting', '#3AB1E4' ) ); ?>">
		<?php
	}

	public function b2bking_colorhover_setting_content() {
		?>
		<input name="b2bking_colorhover_setting" type="color" value="<?php echo esc_attr( get_option( 'b2bking_colorhover_setting', '#0088c2' ) ); ?>">
		<?php
	}

	function b2bking_disable_coupons_b2b_setting_content(){
		?>
		<div class="ui large form">
		  <div class="inline fields">
		  	<div class="field">
		  	  <div class="ui checkbox">
		  	    <input type="radio" tabindex="0" class="hidden" name="b2bking_disable_coupons_b2b_setting" value="disabled" <?php checked('disabled',get_option( 'b2bking_disable_coupons_b2b_setting', 'disabled' ), true); ?>">
		  	    <label><?php esc_html_e('Disabled','b2bking'); ?></label>
		  	  </div>
		  	</div>
		    <div class="field">
		      <div class="ui checkbox">
		        <input type="radio" tabindex="0" class="hidden" name="b2bking_disable_coupons_b2b_setting" value="hideb2b" <?php checked('hideb2b',get_option( 'b2bking_disable_coupons_b2b_setting', 'disabled' ), true); ?>">
		        <label><i class="eye slash icon"></i>&nbsp;<?php esc_html_e('Disable coupons for B2B users','b2bking'); ?></label>
		      </div>
		    </div>
		  </div>
		</div>
		<?php
	}

	function b2bking_hide_stock_for_b2c_setting_content(){
		?>
		<div class="ui large form">
		  <div class="inline fields">
		  	<div class="field">
		  	  <div class="ui checkbox">
		  	    <input type="radio" tabindex="0" class="hidden" name="b2bking_hide_stock_for_b2c_setting" value="disabled" <?php checked('disabled',get_option( 'b2bking_hide_stock_for_b2c_setting', 'disabled' ), true); ?>">
		  	    <label><?php esc_html_e('Disabled','b2bking'); ?></label>
		  	  </div>
		  	</div>
		    <div class="field">
		      <div class="ui checkbox">
		        <input type="radio" tabindex="0" class="hidden" name="b2bking_hide_stock_for_b2c_setting" value="hidecompletely" <?php checked('hidecompletely',get_option( 'b2bking_hide_stock_for_b2c_setting', 'disabled' ), true); ?>">
		        <label><i class="eye slash icon"></i>&nbsp;<?php esc_html_e('Hide stock completely for B2C','b2bking'); ?></label>
		      </div>
		    </div>
		    <div class="field">
		      <div class="ui checkbox">
		        <input type="radio" tabindex="0" class="hidden" name="b2bking_hide_stock_for_b2c_setting" value="hideprecision" <?php checked('hideprecision',get_option( 'b2bking_hide_stock_for_b2c_setting', 'disabled' ), true); ?>">
		        <label><i class="eye slash outline icon"></i>&nbsp;<?php esc_html_e('Hide stock quantities for B2C','b2bking'); ?></label>
		      </div>
		    </div>
		   		    
		  </div>
		</div>
		<?php
	}

	function b2bking_different_stock_treatment_b2b_setting_content(){
		?>
		<div class="ui large form">
		  <div class="inline fields">
		  	<div class="field">
		  	  <div class="ui checkbox">
		  	    <input type="radio" tabindex="0" class="hidden" name="b2bking_different_stock_treatment_b2b_setting" value="disabled" <?php checked('disabled',get_option( 'b2bking_different_stock_treatment_b2b_setting', 'disabled' ), true); ?>">
		  	    <label><?php esc_html_e('Disabled','b2bking'); ?></label>
		  	  </div>
		  	</div>
		  	<div class="field">
		  	  <div class="ui checkbox">
		  	    <input type="radio" tabindex="0" class="hidden" name="b2bking_different_stock_treatment_b2b_setting" value="b2binstock" <?php checked('b2binstock',get_option( 'b2bking_different_stock_treatment_b2b_setting', 'disabled' ), true); ?>">
		  	    <label><i class="clipboard check icon"></i>&nbsp;<?php esc_html_e('Always in stock for B2B','b2bking'); ?></label>
		  	  </div>
		  	</div>
		    <div class="field">
		      <div class="ui checkbox">
		        <input type="radio" tabindex="0" class="hidden" name="b2bking_different_stock_treatment_b2b_setting" value="b2b" <?php checked('b2b',get_option( 'b2bking_different_stock_treatment_b2b_setting', 'disabled' ), true); ?>">
		        <label><i class="briefcase icon"></i>&nbsp;<?php esc_html_e('Separate stock for B2B & B2C','b2bking'); ?></label>
		      </div>
		    </div>
		   		    
		  </div>
		</div>
		<?php
	}

	function b2bking_conversations_endpoint_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<label>'.esc_html__('Endpoint for the My Account -> Conversations page','b2bking').'</label>
				<input type="text" name="b2bking_conversations_endpoint_setting" value="'.esc_attr(get_option('b2bking_conversations_endpoint_setting', 'conversations')).'">
			</div>
		</div>
		';
	}

	function b2bking_conversation_endpoint_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<label>'.esc_html__('Endpoint for a specific conversation page','b2bking').'</label>
				<input type="text" name="b2bking_conversation_endpoint_setting" value="'.esc_attr(get_option('b2bking_conversation_endpoint_setting', 'conversation')).'">
			</div>
		</div>
		';
	}

	function b2bking_offers_endpoint_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<label>'.esc_html__('Endpoint for the My Account -> Offers page','b2bking').'</label>
				<input type="text" name="b2bking_offers_endpoint_setting" value="'.esc_attr(get_option('b2bking_offers_endpoint_setting', 'offers')).'">
			</div>
		</div>
		';
	}

	function b2bking_bulkorder_endpoint_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<label>'.esc_html__('Endpoint for the My Account -> Bulk Order page','b2bking').'</label>
				<input type="text" name="b2bking_bulkorder_endpoint_setting" value="'.esc_attr(get_option('b2bking_bulkorder_endpoint_setting', 'bulkorder')).'">
			</div>
		</div>
		';
	}

	function b2bking_subaccounts_endpoint_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<label>'.esc_html__('Endpoint for the My Account -> Subaccounts page','b2bking').'</label>
				<input type="text" name="b2bking_subaccounts_endpoint_setting" value="'.esc_attr(get_option('b2bking_subaccounts_endpoint_setting', 'subaccounts')).'">
			</div>
		</div>
		';
	}

	function b2bking_subaccount_endpoint_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<label>'.esc_html__('Endpoint for a specific subaccount page','b2bking').'</label>
				<input type="text" name="b2bking_subaccount_endpoint_setting" value="'.esc_attr(get_option('b2bking_subaccount_endpoint_setting', 'subaccount')).'">
			</div>
		</div>
		';
	}

	function b2bking_purchaselists_endpoint_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<label>'.esc_html__('Endpoint for the My Account -> Purchase Lists page','b2bking').'</label>
				<input type="text" name="b2bking_purchaselists_endpoint_setting" value="'.esc_attr(get_option('b2bking_purchaselists_endpoint_setting', 'purchase-lists')).'">
			</div>
		</div>
		';
	}

	function b2bking_purchaselist_endpoint_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<label>'.esc_html__('Endpoint for a specific purchase list page','b2bking').'</label>
				<input type="text" name="b2bking_purchaselist_endpoint_setting" value="'.esc_attr(get_option('b2bking_purchaselist_endpoint_setting', 'purchase-list')).'">
			</div>
		</div>
		';
	}
	function b2bking_credit_endpoint_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<label>'.esc_html__('Endpoint for the company credit section','b2bking').'</label>
				<input type="text" name="b2bking_credit_endpoint_setting" value="'.esc_attr(get_option('b2bking_credit_endpoint_setting', 'company-credit')).'">
			</div>
		</div>
		';
	}

	function b2bking_show_discount_in_table_setting_description(){
		ob_start();
		echo esc_html__('Show Discount % in Table', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Calculate and show a discount percentage column in table','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_show_discount_in_table_setting_toggle(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_show_discount_in_table_setting" value="1" '.checked(1,get_option( 'b2bking_show_discount_in_table_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_color_price_range_setting_description(){
		ob_start();
		echo esc_html__('Color Price Range', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Dynamically color the active price range in table','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_color_price_range_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_color_price_range_setting" value="1" '.checked(1,get_option( 'b2bking_color_price_range_setting', 1 ), false).'">
		</div>
		';
	}

	function b2bking_table_is_clickable_setting_description(){
		ob_start();
		echo esc_html__('Table is Clickable', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Clicking the table sets the quantity to the range selected','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_table_is_clickable_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_table_is_clickable_setting" value="1" '.checked(1,get_option( 'b2bking_table_is_clickable_setting', 1 ), false).'">
		</div>
		';
	}

	function b2bking_show_tieredp_product_page_setting_description(){
		ob_start();

		$tip = esc_html__('Tiered price range replaces price on the frontend.','b2bking').'<br><img class="b2bking_tooltip_img" src="https://kingsplugins.com/wp-content/uploads/2024/08/tieredrange.png">';
		echo esc_html__('Show Tiered Price Range', 'b2bking').'&nbsp;'.wc_help_tip($tip, false);
		echo '<p class="b2bking_setting_description">'.esc_html__('Replaces price with a tiered price range (min - max) on the frontend','b2bking').'</p>';
		return ob_get_clean();
	}
	function b2bking_show_tieredp_product_page_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_show_tieredp_product_page_setting" value="1" '.checked(1,get_option( 'b2bking_show_tieredp_product_page_setting', 0 ), false).'">
		</div>
		';		
	} 


	function b2bking_enter_percentage_tiered_setting_description(){
		ob_start();

		$tip = esc_html__('When configuring tiered pricing, you will enter percentage discounts instead of final prices.','b2bking').'<br><img class="b2bking_tooltip_img" src="https://kingsplugins.com/wp-content/uploads/2024/08/percentagediscounts.png">';

		echo esc_html__('Enter % Instead of Prices', 'b2bking').'&nbsp;'.wc_help_tip($tip, false);

		echo '<p class="b2bking_setting_description">'.esc_html__('Configure tiered prices as % discounts, rather than final prices','b2bking').'</p>';

		return ob_get_clean();
	}

	function b2bking_enter_percentage_tiered_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_enter_percentage_tiered_setting" value="1" '.checked(1,get_option( 'b2bking_enter_percentage_tiered_setting', 0 ), false).'">
		</div>
		';	
	}

	function b2bking_vat_exemption_different_country_setting_description(){
		ob_start();
		echo esc_html__('Different delivery country', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Require delivery country to be different than shop country for VAT exemption. Not recommended for most setups - enable only if needed.','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_vat_exemption_different_country_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_vat_exemption_different_country_setting" value="1" '.checked(1,get_option( 'b2bking_vat_exemption_different_country_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_product_visibility_cache_setting_description(){
		ob_start();
		echo esc_html__('Product visibility cache', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Some situations may require disabling this setting.','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_product_visibility_cache_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_product_visibility_cache_setting" value="1" '.checked(1,get_option( 'b2bking_product_visibility_cache_setting', 1 ), false).'">
		</div>
		';
	}

	function b2bking_enable_company_approval_setting_description(){
		ob_start();
		echo esc_html__('Company Order Approval', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Allows users to enable order review and approval for their subaccounts\' orders.','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_enable_company_approval_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_enable_company_approval_setting" value="1" '.checked(1,get_option( 'b2bking_enable_company_approval_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_product_options_compatibility_setting_description(){
		ob_start();
		echo esc_html__('Product addons / options compatibility', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Improves pricing compatibility with plugins that add product options / addons. Not recommended for most setups - enable only if needed.','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_product_options_compatibility_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_product_options_compatibility_setting" value="1" '.checked(1,get_option( 'b2bking_product_options_compatibility_setting', 0 ), false).'">
		</div>
		';
	}


	function b2bking_hide_prices_quote_only_setting_description(){
		ob_start();

		echo esc_html__('Hide prices in quote-only mode', 'b2bking');

		echo '<p class="b2bking_setting_description">'.esc_html__('If customers can only make quote requests, this setting controls whether prices are hidden or shown.','b2bking').'</p>';

		return ob_get_clean();
	}

	function b2bking_hide_prices_quote_only_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_hide_prices_quote_only_setting" value="1" '.checked(1,get_option( 'b2bking_hide_prices_quote_only_setting', 1 ), false).'">
		</div>
		';
	}


	function b2bking_replace_product_selector_setting_description(){
		ob_start();
		echo esc_html__('Dynamic rules: replace product dropdown', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Replaces product dropdown with text box for product IDs.','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_replace_product_selector_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_replace_product_selector_setting" value="1" '.checked(1,get_option( 'b2bking_replace_product_selector_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_hide_users_dynamic_rules_setting_description(){
		ob_start();
		echo esc_html__('Dynamic rules: replace users dropdown', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Replaces user dropdown with text box for user IDs.','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_hide_users_dynamic_rules_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_hide_users_dynamic_rules_setting" value="1" '.checked(1,get_option( 'b2bking_hide_users_dynamic_rules_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_customers_panel_ajax_setting_description(){
		ob_start();
		echo esc_html__('Customers panel: Search by AJAX', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Load users with AJAX in the admin customers panel.','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_customers_panel_ajax_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_customers_panel_ajax_setting" value="1" '.checked(1,get_option( 'b2bking_customers_panel_ajax_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_hidden_has_priority_setting_description(){
		ob_start();

		$tip = esc_html__('Normally if a product is part of multiple categories, it will be visible if at least 1 category is visible. With "Hidden Has Priority" enabled, the product will be hidden if at least 1 category is hidden. Click for documentation.','b2bking');

		echo esc_html__('Hidden Has Priority', 'b2bking').'&nbsp;<a target="_blank" href="https://woocommerce-b2b-plugin.com/docs/advanced-visibility-settings-explained/">'.wc_help_tip($tip, false).'</a>';
		echo '<p class="b2bking_setting_description">'.esc_html__('Hide products if they are part of at least 1 hidden category','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_hidden_has_priority_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_hidden_has_priority_setting" value="1" '.checked(1,get_option( 'b2bking_hidden_has_priority_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_force_permalinks_setting_description(){
		ob_start();
		echo esc_html__('Change My Account URL Structure', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Changes URL structure in My Account. Can solve 404 error issues and improve loading speed.','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_force_permalinks_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_force_permalinks_setting" value="1" '.checked(1,get_option( 'b2bking_force_permalinks_setting', 1 ), false).'">
		</div>
		';
	}

	function b2bking_force_permalinks_flushing_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_force_permalinks_flushing_setting" value="1" '.checked(1,get_option( 'b2bking_force_permalinks_flushing_setting', 1 ), false).'">
		  <label>'.esc_html__('Force permalinks rewrite. Can solve 404 issues in My Account page.','b2bking').'</label>
		</div>
		';
	}

    function b2bking_show_dynamic_rules_vendors_setting_wcfm_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_show_dynamic_rules_vendors_setting_wcfm" value="1" '.checked(1,get_option( 'b2bking_show_dynamic_rules_vendors_setting_wcfm', 1 ), false).'">
		  <label>'.esc_html__('Show rules to vendors in dashboard','b2bkingwcfm').'</label>
		</div>
		';
    }

    function b2bking_show_visibility_vendors_setting_wcfm_content(){
        echo '
        <div class="ui toggle checkbox">
          <input type="checkbox" name="b2bking_show_visibility_vendors_setting_wcfm" value="1" '.checked(1,get_option( 'b2bking_show_visibility_vendors_setting_wcfm', 1 ), false).'">
          <label>'.esc_html__('Show visibility to vendors in dashboard for each product','b2bkingwcfm').'</label>
        </div>
        ';
    }

    function b2bking_show_dynamic_rules_vendors_setting_marketking_content(){
    	echo '
    	<div class="ui toggle checkbox">
    	  <input type="checkbox" name="b2bking_show_dynamic_rules_vendors_setting_marketking" value="1" '.checked(1,get_option( 'b2bking_show_dynamic_rules_vendors_setting_marketking', 1 ), false).'">
    	  <label>'.esc_html__('Show rules to vendors in dashboard','b2bkingmarketking').'</label>
    	</div>
    	';
    }

    function b2bking_show_visibility_vendors_setting_marketking_content(){
        echo '
        <div class="ui toggle checkbox">
          <input type="checkbox" name="b2bking_show_visibility_vendors_setting_marketking" value="1" '.checked(1,get_option( 'b2bking_show_visibility_vendors_setting_marketking', 1 ), false).'">
          <label>'.esc_html__('Show visibility to vendors in dashboard for each product','b2bkingmarketking').'</label>
        </div>
        ';
    }



	/* Offer Settings */

	function b2bking_offers_product_selector_setting_description(){
		ob_start();
		echo esc_html__('Show product selector in offers', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Replace text box with product selector','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_offers_product_selector_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_offers_product_selector_setting" value="1" '.checked(1,get_option( 'b2bking_offers_product_selector_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_offers_product_image_setting_description(){
		ob_start();


		$tip = '<img class="b2bking_tooltip_img" src="https://kingsplugins.com/wp-content/uploads/2024/08/product-image-offer-explainer.webp">';

		echo esc_html__('Show product image in offers frontend', 'b2bking').'&nbsp;'.wc_help_tip($tip, false);
		echo '<p class="b2bking_setting_description">'.esc_html__('Show product images in My Account->Offers and in Offer PDFs','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_offers_product_image_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_offers_product_image_setting" value="1" '.checked(1,get_option( 'b2bking_offers_product_image_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_offer_one_per_user_setting_description(){
		ob_start();
		echo esc_html__('Offers can only be purchased once', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Each user can only purchase an offer once before it disappears','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_offer_one_per_user_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_offer_one_per_user_setting" value="1" '.checked(1,get_option( 'b2bking_offer_one_per_user_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_offer_use_products_setting_description(){
		ob_start();

		$tip = esc_html__('When enabled, offers use a new system that adds the actual products of the offer to cart, rather than just a text description of the products.','b2bking');

		echo esc_html__('Offers use actual products', 'b2bking').'&nbsp;'.wc_help_tip($tip, false);
		echo '<p class="b2bking_setting_description">'.esc_html__('The actual products of the offer are added to cart','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_offer_use_products_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_offer_use_products_setting" value="1" '.checked(1,get_option( 'b2bking_offer_use_products_setting', 1 ), false).'">
		</div>
		';
	}
	
	function b2bking_offers_logo_setting_description(){
		ob_start();

		$tip = '<img class="b2bking_tooltip_img" src="https://kingsplugins.com/wp-content/uploads/2024/08/offer-logo-image-explainer.webp">';

		echo esc_html__('Offers PDF Logo', 'b2bking').'&nbsp;'.wc_help_tip($tip, false);
		echo '<p class="b2bking_setting_description">'.esc_html__('Logo shown on Offer PDFs (e.g. company logo)','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_offers_logo_setting_content(){
		echo '
			<div>
			    <input type="text" name="b2bking_offers_logo_setting" id="b2bking_offers_logo_setting" class="regular-text" placeholder="'.esc_attr__('Your Custom Logo', 'b2bking').'" value="'.esc_attr(get_option('b2bking_offers_logo_setting','')).'">&nbsp;&nbsp;
			    <input type="button" name="b2bking-logo-upload-btn" id="b2bking-logo-upload-btn" class="ui blue button tiny" value="'.esc_attr__('Select Image','b2bking').'">
			</div>
		';
	}

	function b2bking_offers_image_setting_description(){
		ob_start();

		$tip = '<img class="b2bking_tooltip_img" src="https://kingsplugins.com/wp-content/uploads/2024/08/image-cart-offers.webp">';

		echo esc_html__('Offers Cart Image', 'b2bking').'&nbsp;'.wc_help_tip($tip, false);
		echo '<p class="b2bking_setting_description">'.esc_html__('Thumbnail image of offers in cart (for offers with 2+ products)','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_offers_image_setting_content(){
		echo '
			<div>
			    <input type="text" name="b2bking_offers_image_setting" id="b2bking_offers_image_setting" class="regular-text" placeholder="'.esc_attr__('Image for offers', 'b2bking').'" value="'.esc_attr(get_option('b2bking_offers_image_setting','')).'">&nbsp;&nbsp;
			    <input type="button" name="b2bking-logoimg-upload-btn" id="b2bking-logoimg-upload-btn" class="ui blue button tiny" value="'.esc_attr__('Select Image','b2bking').'">
			</div>
		';
	}

	/* Performance Settings	*/

	function b2bking_disable_group_tiered_pricing_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_group_tiered_pricing_setting" value="1" '.checked(1,get_option( 'b2bking_disable_group_tiered_pricing_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_disable_product_level_minmaxstep_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_product_level_minmaxstep_setting" value="1" '.checked(1,get_option( 'b2bking_disable_product_level_minmaxstep_setting', 1 ), false).'">
		</div>
		';
	}

	function b2bking_disble_coupon_for_b2b_values_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disble_coupon_for_b2b_values_setting" value="1" '.checked(1,get_option( 'b2bking_disble_coupon_for_b2b_values_setting', 1 ), false).'">
		</div>
		';
	}

	
	function b2bking_disable_registration_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_registration_setting" value="1" '.checked(1,get_option( 'b2bking_disable_registration_setting', 0 ), false).'">
		</div>
		';
	}


	function b2bking_disable_registration_scripts_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_registration_scripts_setting" value="1" '.checked(1,get_option( 'b2bking_disable_registration_scripts_setting', 0 ), false).'">
		</div>
		';
	}
	function b2bking_disable_dynamic_rule_discount_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_dynamic_rule_discount_setting" value="1" '.checked(1,get_option( 'b2bking_disable_dynamic_rule_discount_setting', 0 ), false).'">
		</div>
		';
	}
	function b2bking_disable_dynamic_rule_discount_sale_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_dynamic_rule_discount_sale_setting" value="1" '.checked(1,get_option( 'b2bking_disable_dynamic_rule_discount_sale_setting', 0 ), false).'">
		</div>
		';
	}
	function b2bking_disable_dynamic_rule_addtax_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_dynamic_rule_addtax_setting" value="1" '.checked(1,get_option( 'b2bking_disable_dynamic_rule_addtax_setting', 0 ), false).'">
		</div>
		';
	}
	function b2bking_disable_dynamic_rule_fixedprice_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_dynamic_rule_fixedprice_setting" value="1" '.checked(1,get_option( 'b2bking_disable_dynamic_rule_fixedprice_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_disable_dynamic_rule_freeshipping_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_dynamic_rule_freeshipping_setting" value="1" '.checked(1,get_option( 'b2bking_disable_dynamic_rule_freeshipping_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_disable_dynamic_rule_minmax_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_dynamic_rule_minmax_setting" value="1" '.checked(1,get_option( 'b2bking_disable_dynamic_rule_minmax_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_disable_dynamic_rule_hiddenprice_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_dynamic_rule_hiddenprice_setting" value="1" '.checked(1,get_option( 'b2bking_disable_dynamic_rule_hiddenprice_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_disable_dynamic_rule_requiredmultiple_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_dynamic_rule_requiredmultiple_setting" value="1" '.checked(1,get_option( 'b2bking_disable_dynamic_rule_requiredmultiple_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_disable_dynamic_rule_zerotax_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_dynamic_rule_zerotax_setting" value="1" '.checked(1,get_option( 'b2bking_disable_dynamic_rule_zerotax_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_disable_dynamic_rule_taxexemption_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_dynamic_rule_taxexemption_setting" value="1" '.checked(1,get_option( 'b2bking_disable_dynamic_rule_taxexemption_setting', 0 ), false).'">
		</div>
		';
	}
	function b2bking_disable_shipping_control_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_shipping_control_setting" value="1" '.checked(1,get_option( 'b2bking_disable_shipping_control_setting', 0 ), false).'">
		</div>
		';
	}

	function b2bking_disable_payment_control_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_disable_payment_control_setting" value="1" '.checked(1,get_option( 'b2bking_disable_payment_control_setting', 0 ), false).'">
		</div>
		';
	}
	
	

	// This function remembers the current tab as a hidden input setting. When the page loads, it goes to the saved tab
	function b2bking_current_tab_setting_content(){
		echo '
		 <input type="hidden" id="b2bking_current_tab_setting_input" name="b2bking_current_tab_setting" value="'.esc_attr(get_option( 'b2bking_current_tab_setting', 'accessrestriction' )).'">
		';
	}

	function b2bking_check_visibility_setting_change($old_value, $new_value, $option_name) {

	    if ($old_value !== $new_value) {
	        if (empty($new_value)){
	        	// empty means that control visibility is set

	        	// go through all categories and check if the visibility meta key does not exist. If so, set it to 1 (visible)
	        	$terms = get_terms(array(
	        		'taxonomy' => apply_filters('b2bking_visibility_taxonomy','product_cat'),
	        		'fields'=> 'ids',
	        		'post_status' => 'publish',
	        		'numberposts' => -1,
	        		'hide_empty' => false
	        	));

	        	$groups = get_posts([
	        	  'post_type' => 'b2bking_group',
	        	  'post_status' => 'publish',
	        	  'numberposts' => -1,
	        	  'fields' =>'ids',
	        	]);

	        	if (!empty($terms)) {
	        	    // loop trough each term
	        	    foreach ($terms as $term){
	        	    	if (!metadata_exists('term', $term, 'b2bking_group_0')){
	        	    		update_term_meta($term, 'b2bking_group_0', 1);
	        	    	}

	        	    	if (!metadata_exists('term', $term, 'b2bking_group_b2c')){
	        	    		update_term_meta($term, 'b2bking_group_b2c', 1);
	        	    	}

        				foreach ($groups as $group){
        					if (!metadata_exists('term', $term, 'b2bking_group_'.$group)){
        						update_term_meta($term, 'b2bking_group_'.$group, 1);
        					}
        				}
        			}
        		}
	        }
	    }
	}

	function b2bking_set_offer_sold_individually($old_value, $new_value, $option_name) {

	    if ($old_value !== $new_value) {
	        // offer sold individually
	        $offer_id = intval(get_option('b2bking_offer_product_id_setting', 0));
	        if ($offer_id !== 0){
	        	if (intval($new_value) === 1){
	        		update_post_meta($offer_id,'_sold_individually', 'yes');
	        	} else {
	        		update_post_meta($offer_id,'_sold_individually', 'no');
	        	}
	        }
	    }
	}

	function b2bking_all_products_visible_all_users_setting_description(){
		ob_start();
		echo esc_html__('All Products Visible', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Show all products to customers, or control it individually','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_all_products_visible_all_users_setting_content(){

		$enabled = intval(get_option( 'b2bking_all_products_visible_all_users_setting', 1 ));

		echo '
		<div class="ui toggle checkbox" style="display:none">
		  <input type="checkbox" name="b2bking_all_products_visible_all_users_setting" value="1" '.checked(1,get_option( 'b2bking_all_products_visible_all_users_setting', 1 ), false).'">
		</div>
		';

		?>

		<div class="ui two column grid b2bking_grid_min b2bking_grid_two_columns">
		  <div class="column b2bking_centered_column">
		    <div class="ui segment b2bking_icon_svg_setting b2bking_setting_block <?php if ($enabled === 1) { echo 'active'; } ?>" data-value="enabled" data-setting="b2bking_all_products_visible_all_users_setting">
		    	
		    	<svg class="b2bking_setting_eye_visible" clip-rule="evenodd" fill-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m17.5 11c2.484 0 4.5 2.016 4.5 4.5s-2.016 4.5-4.5 4.5-4.5-2.016-4.5-4.5 2.016-4.5 4.5-4.5zm-5.346 6.999c-.052.001-.104.001-.156.001-4.078 0-7.742-3.093-9.854-6.483-.096-.159-.144-.338-.144-.517s.049-.358.145-.517c2.111-3.39 5.775-6.483 9.853-6.483 4.143 0 7.796 3.09 9.864 6.493.092.156.138.332.138.507 0 .179-.062.349-.15.516-.58-.634-1.297-1.14-2.103-1.472-1.863-2.476-4.626-4.544-7.749-4.544-3.465 0-6.533 2.632-8.404 5.5 1.815 2.781 4.754 5.34 8.089 5.493.09.529.25 1.034.471 1.506zm3.071-2.023 1.442 1.285c.095.085.215.127.333.127.136 0 .271-.055.37-.162l2.441-2.669c.088-.096.131-.217.131-.336 0-.274-.221-.499-.5-.499-.136 0-.271.055-.37.162l-2.108 2.304-1.073-.956c-.096-.085-.214-.127-.333-.127-.277 0-.5.224-.5.499 0 .137.056.273.167.372zm-3.603-.994c-2.031-.19-3.622-1.902-3.622-3.982 0-2.208 1.792-4 4-4 1.804 0 3.331 1.197 3.829 2.84-.493.146-.959.354-1.389.615-.248-1.118-1.247-1.955-2.44-1.955-1.38 0-2.5 1.12-2.5 2.5 0 1.363 1.092 2.472 2.448 2.499-.169.47-.281.967-.326 1.483z" fill-rule="nonzero"/></svg>

		    </div>
		    <p class="b2bking_block_description"><?php esc_html_e('All Products Visible'); ?></p>
		  </div>

		  <div class="column b2bking_centered_column">
		    <div class="ui segment b2bking_icon_svg_setting b2bking_setting_block <?php if ($enabled === 0) { echo 'active'; } ?>" data-value="disabled" data-setting="b2bking_all_products_visible_all_users_setting">

		    	<svg class="b2bking_setting_cog_visible" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="#292D32" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M2 12.8799V11.1199C2 10.0799 2.85 9.21994 3.9 9.21994C5.71 9.21994 6.45 7.93994 5.54 6.36994C5.02 5.46994 5.33 4.29994 6.24 3.77994L7.97 2.78994C8.76 2.31994 9.78 2.59994 10.25 3.38994L10.36 3.57994C11.26 5.14994 12.74 5.14994 13.65 3.57994L13.76 3.38994C14.23 2.59994 15.25 2.31994 16.04 2.78994L17.77 3.77994C18.68 4.29994 18.99 5.46994 18.47 6.36994C17.56 7.93994 18.3 9.21994 20.11 9.21994C21.15 9.21994 22.01 10.0699 22.01 11.1199V12.8799C22.01 13.9199 21.16 14.7799 20.11 14.7799C18.3 14.7799 17.56 16.0599 18.47 17.6299C18.99 18.5399 18.68 19.6999 17.77 20.2199L16.04 21.2099C15.25 21.6799 14.23 21.3999 13.76 20.6099L13.65 20.4199C12.75 18.8499 11.27 18.8499 10.36 20.4199L10.25 20.6099C9.78 21.3999 8.76 21.6799 7.97 21.2099L6.24 20.2199C5.33 19.6999 5.02 18.5299 5.54 17.6299C6.45 16.0599 5.71 14.7799 3.9 14.7799C2.85 14.7799 2 13.9199 2 12.8799Z" stroke="#292D32" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>

		    </div>
		    <p class="b2bking_block_description"><?php esc_html_e('Control Visibility'); ?></p>

		  </div>
		</div>
		
		<?php
	}

	function b2bking_guest_access_restriction_setting_website_redirect_description(){
		ob_start();
		echo esc_html__('Restrict all pages', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Enable this to also restrict access to pages. Disable this to hide shop & products, but show other pages.','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_guest_access_restriction_setting_website_redirect_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_guest_access_restriction_setting_website_redirect" value="1" '.checked(1,get_option( 'b2bking_guest_access_restriction_setting_website_redirect', 0 ), false).'">
		</div>
		';
	}

	function b2bking_registration_roles_dropdown_setting_description(){
		ob_start();

		$tip = esc_html__('Shows user type dropdown on WooCommerce registration pages.','b2bking').'<br><img class="b2bking_tooltip_img" src="https://kingsplugins.com/wp-content/uploads/2024/08/enabledropdown2.jpeg">';

		echo esc_html__('Enable Dropdown & Fields', 'b2bking').'&nbsp;'.wc_help_tip($tip, false);
		echo '<p class="b2bking_setting_description">'.esc_html__('Show user type dropdown and custom fields on WooCommerce registration pages','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_registration_roles_dropdown_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_registration_roles_dropdown_setting" value="1" '.checked(1,get_option( 'b2bking_registration_roles_dropdown_setting', 1 ), false).'">
		</div>
		';
	}

	function b2bking_approval_required_all_users_setting_description(){
		ob_start();

		$tip = esc_html__('Approval can be controlled for each registration option in B2BKing -> Registration Roles. This setting is only useful in cases where registration is done through external pages or plugins that do not show B2BKing registration options.','b2bking');

		echo esc_html__('Manual Approval for All', 'b2bking').'&nbsp;'.wc_help_tip($tip, false);
		echo '<p class="b2bking_setting_description">'.esc_html__('Require manual approval for all user registrations, including for B2C users.','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_approval_required_all_users_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_approval_required_all_users_setting" value="1" '.checked(1,get_option( 'b2bking_approval_required_all_users_setting', 0 ), false).'">
		</div>
		';	
	}

	function b2bking_registration_at_checkout_setting_description(){
		ob_start();
		echo esc_html__('Registration at Checkout', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Adds B2BKing registration options to checkout registration.','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_registration_at_checkout_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_registration_at_checkout_setting" value="1" '.checked(1,get_option( 'b2bking_registration_at_checkout_setting', 0 ), false).'">
		</div>
		';	
	}

	function b2bking_registration_loggedin_setting_description(){
		ob_start();
		echo esc_html__('Existing Users Can Apply', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Existing B2C customers can apply to convert / upgrade their account to a B2B account.','b2bking').'</p>';
		?>
		<div class="ui ignored warning icon message b2bking_existing_users_apply_warning" style="display:none">
	      <div class="content">
	        <p><?php esc_html_e('This setting affects how registration approval works: B2B users that require approval are initially registered as B2C, and can immediately access the site while their B2B application is pending.','b2bking');?></p>
	      </div>
	      <i class="exclamation icon"></i>
	     </div>
		<?php
		return ob_get_clean();
	}

	function b2bking_registration_loggedin_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_registration_loggedin_setting" value="1" '.checked(1,get_option( 'b2bking_registration_loggedin_setting', 0 ), false).'">

		</div>
		';	
	}

	function b2bking_order_form_theme_setting_description(){
		ob_start();
		echo esc_html__('Order Form Theme', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Set the default order form theme','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_order_form_theme_setting_content(){
		$selected = get_option( 'b2bking_order_form_theme_setting', 'classic' );
		echo '
		  <select name="b2bking_order_form_theme_setting" id="b2bking_order_form_theme_setting_select" style="display:none">
		  	<option value="classic" '.selected('classic', get_option( 'b2bking_order_form_theme_setting', 'classic' ), false).'">'.esc_html__('Classic','b2bking').'</option>
		  	<option value="indigo" '.selected('indigo', get_option( 'b2bking_order_form_theme_setting', 'classic' ), false).'">'.esc_html__('Indigo','b2bking').'</option>		  
		  	<option value="cream" '.selected('cream', get_option( 'b2bking_order_form_theme_setting', 'classic' ), false).'">'.esc_html__('Cream','b2bking').'</option>		  
		  </select>
		';
		?>
		<div class="ui three column grid b2bking_grid_min">
		  <div class="column">
		    <div class="ui segment b2bking_setting_block <?php if ($selected === 'classic') { echo 'active'; } ?>" data-value="classic" data-setting="b2bking_order_form_theme_setting_select">
		      <?php echo '<img src="'.plugins_url('../includes/assets/images/classicmin.png', __FILE__).'" width="120px" height="120px">'; ?>
		    </div>
		    <p class="b2bking_block_description"><?php esc_html_e('Classic'); ?></p>
		  </div>

		  <div class="column">
		    <div class="ui segment b2bking_setting_block <?php if ($selected === 'indigo') { echo 'active'; } ?>" data-value="indigo" data-setting="b2bking_order_form_theme_setting_select">
		    	<?php echo '<img src="'.plugins_url('../includes/assets/images/indigomin.png', __FILE__).'" width="120px" height="120px">'; ?>
		    </div>
		    <p class="b2bking_block_description"><?php esc_html_e('Indigo'); ?></p>

		  </div>
		  
		  <div class="column">
		    <div class="ui segment b2bking_setting_block <?php if ($selected === 'cream') { echo 'active'; } ?>" data-value="cream" data-setting="b2bking_order_form_theme_setting_select">
		    	<a class="ui orange right corner label tiny b2bking_orange">
		            <i class="fire icon"></i>
		          </a>
		      <?php echo '<img src="'.plugins_url('../includes/assets/images/creammin.png', __FILE__).'" width="120px" height="120px">'; ?>
		    </div>
		    <p class="b2bking_block_description"><?php esc_html_e('Cream'); ?></p>

		  </div>
		</div>
		<?php
	}

	function b2bking_order_form_creme_cart_button_setting_description(){
		ob_start();
		echo esc_html__('Cream Form Top Button', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Show a cart or checkout button in the top right corner','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_order_form_creme_cart_button_setting_content(){
		$selected = get_option( 'b2bking_order_form_creme_cart_button_setting', 'cart' );

		echo '
		  <select name="b2bking_order_form_creme_cart_button_setting" id="b2bking_order_form_creme_cart_button_setting_select" style="display:none">
		  	<option value="cart" '.selected('cart', get_option( 'b2bking_order_form_creme_cart_button_setting', 'cart' ), false).'">'.esc_html__('Cart Icon + Total','b2bking').'</option>
		  	<option value="carticon" '.selected('carticon', get_option( 'b2bking_order_form_creme_cart_button_setting', 'cart' ), false).'">'.esc_html__('Cart Icon','b2bking').'</option>
		  	<option value="checkout" '.selected('checkout', get_option( 'b2bking_order_form_creme_cart_button_setting', 'cart' ), false).'">'.esc_html__('Checkout Button','b2bking').'</option>		  
		  </select>
		';

		?>
		<div class="ui three column grid b2bking_grid_min">
		  <div class="column">
		    <div class="ui segment b2bking_setting_block b2bking_setting_block_noborder <?php if ($selected === 'cart') { echo 'active'; } ?>" data-value="cart" data-setting="b2bking_order_form_creme_cart_button_setting_select">
		      <?php echo '<img src="'.plugins_url('../includes/assets/images/bulkcarticontotal.png', __FILE__).'" width="auto" height="45px">'; ?>
		    </div>
		    <p class="b2bking_block_description"><?php esc_html_e('Cart Icon + Total'); ?></p>
		  </div>

		  <div class="column">
		    <div class="ui segment b2bking_setting_block b2bking_setting_block_noborder <?php if ($selected === 'carticon') { echo 'active'; } ?>" data-value="carticon" data-setting="b2bking_order_form_creme_cart_button_setting_select">
		    	<?php echo '<img src="'.plugins_url('../includes/assets/images/bulkcart.png', __FILE__).'" width="auto" height="45px">'; ?>
		    </div>
		    <p class="b2bking_block_description"><?php esc_html_e('Cart Icon'); ?></p>

		  </div>
		  
		  <div class="column">
		    <div class="ui segment b2bking_setting_block b2bking_setting_block_noborder <?php if ($selected === 'checkout') { echo 'active'; } ?>" data-value="checkout" data-setting="b2bking_order_form_creme_cart_button_setting_select">
		      <?php echo '<img src="'.plugins_url('../includes/assets/images/bulkcheckout.png', __FILE__).'" width="auto" height="45px">'; ?>
		    </div>
		    <p class="b2bking_block_description"><?php esc_html_e('Checkout Button'); ?></p>

		  </div>
		</div>
		<?php
	}

	function b2bking_order_form_sortby_setting_description(){
		ob_start();
		echo esc_html__('Sort Products By', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Default sort order for products in the form','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_order_form_sortby_setting_content(){
		echo '
		  <select name="b2bking_order_form_sortby_setting" id="b2bking_order_form_sortby_setting_select">
		  	<option value="atoz" '.selected('atoz', get_option( 'b2bking_order_form_sortby_setting', 'atoz' ), false).'">'.esc_html__('Alphabetically, A -> Z','b2bking').'</option>
		  	<option value="ztoa" '.selected('ztoa', get_option( 'b2bking_order_form_sortby_setting', 'atoz' ), false).'">'.esc_html__('Alphabetically, Z -> A','b2bking').'</option>		  
		  	<option value="bestselling" '.selected('bestselling', get_option( 'b2bking_order_form_sortby_setting', 'atoz' ), false).'">'.esc_html__('Best Selling','b2bking').'</option>		  
		  	<option value="latest" '.selected('latest', get_option( 'b2bking_order_form_sortby_setting', 'atoz' ), false).'">'.esc_html__('Latest','b2bking').'</option>		  
		  	<option value="automatic" '.selected('automatic', get_option( 'b2bking_order_form_sortby_setting', 'atoz' ), false).'">'.esc_html__('Automatic','b2bking').'</option>		  
		  </select>
		';
	}

	function b2bking_registration_separate_my_account_page_setting_description(){
		ob_start();


		$tip = esc_html__('By default, B2BKing will automatically show B2B and B2C users different content and options on the "my account" page. This setting goes a step further and actually creates different pages. Not recommended in most cases, as it complicates setup and can lead to issues.','b2bking');

		echo esc_html__('Separate My Account Page for B2B', 'b2bking').'&nbsp;'.wc_help_tip($tip, false);
		echo '<p class="b2bking_setting_description">'.esc_html__('Set a different My Account page for business users. Not recommended for most setups.','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_registration_separate_my_account_page_setting_content(){
		echo '
		  <select name="b2bking_registration_separate_my_account_page_setting">
		  	<option value="disabled" '.selected('disabled', get_option( 'b2bking_registration_separate_my_account_page_setting', 'disabled' ), false).'">'.esc_html__('Disabled','b2bking').'</option>';
		  // get pages
		  $pages = get_pages();
		  $woo_my_acc_page_id = wc_get_page_id( 'myaccount' );
		  foreach ($pages as $page){
		  	if ($page->ID == $woo_my_acc_page_id){
		  		continue;
		  	}
		  	echo '<option value="'.esc_attr($page->ID).'" '.selected($page->ID, get_option( 'b2bking_registration_separate_my_account_page_setting', 'disabled' ), false).'">'.esc_html($page->post_title).'</option>';
		  }
		  echo'</select>';	
	}

	function b2bking_validate_vat_button_checkout_setting_description(){
		ob_start();
		echo esc_html__('Validate VAT button at checkout', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('If VAT Number is provided during checkout / checkout registration, this button validates and applies VAT exemptions','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_validate_vat_button_checkout_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_validate_vat_button_checkout_setting" value="1" '.checked(1,get_option( 'b2bking_validate_vat_button_checkout_setting', 0 ), false).'">
		</div>
		';	
	}

	function b2bking_enable_conversations_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_enable_conversations_setting" value="1" '.checked(1,get_option( 'b2bking_enable_conversations_setting', 1 ), false).'">
		</div>
		';	
	}

	function b2bking_enable_offers_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_enable_offers_setting" value="1" '.checked(1,get_option( 'b2bking_enable_offers_setting', 1 ), false).'">
		</div>
		';	
	}

	function b2bking_enable_subaccounts_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_enable_subaccounts_setting" value="1" '.checked(1,get_option( 'b2bking_enable_subaccounts_setting', 1 ), false).'">
		</div>
		';	
	}

	function b2bking_enable_bulk_order_form_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_enable_bulk_order_form_setting" value="1" '.checked(1,get_option( 'b2bking_enable_bulk_order_form_setting', 1 ), false).'">
		</div>
		';	
	}

	function b2bking_enable_purchase_lists_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_enable_purchase_lists_setting" value="1" '.checked(1,get_option( 'b2bking_enable_purchase_lists_setting', 1 ), false).'">
		</div>
		';	
	}

	function b2bking_keepdata_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_keepdata_setting" value="1" '.checked(1,get_option( 'b2bking_keepdata_setting', 1 ), false).'">
		  <label>'.esc_html__('WARNING: Disabling this DELETES ALL plugin data when the plugin is uninstalled. We recommend you keep this enabled.','b2bking').'</label>
		</div>
		';	
	}

	function b2bking_multisite_separate_b2bb2c_setting_description(){
		ob_start();
		echo esc_html__('Separate B2B and B2C sites in multisite', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('If you have a multisite and separate B2B and B2C sites, this option will treat B2C users as guests when visiting the B2B site and lock them out','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_multisite_separate_b2bb2c_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_multisite_separate_b2bb2c_setting" value="1" '.checked(1,get_option( 'b2bking_multisite_separate_b2bb2c_setting', 0 ), false).'">
		</div>
		';	
	}

	function b2bking_order_form_cream_multiselect_setting_description(){
		ob_start();

		$tip = esc_html__('Select and add multiple items to cart with a single click.','b2bking').'<br><img class="b2bking_tooltip_img_large" src="https://kingsplugins.com/wp-content/uploads/2024/07/multi-select.webp">';

		echo esc_html__('Enable Multi-Select', 'b2bking').'&nbsp;'.wc_help_tip($tip, false);
		echo '<p class="b2bking_setting_description">'.esc_html__('Allow selecting and adding multiple items at once','b2bking').'</p>';
		return ob_get_clean();
	}


	function b2bking_order_form_cream_multiselect_setting_content(){
		echo '
		<div id="b2bking_order_form_cream_multiselect_container" class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_order_form_cream_multiselect_setting" value="1" '.checked(1,get_option( 'b2bking_order_form_cream_multiselect_setting', 0 ), false).'">
		</div>
		';	
	}

	function b2bking_search_by_sku_setting_description(){
		ob_start();
		echo esc_html__('Search by SKU', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Enable searching by SKU in the Bulk Order Form','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_search_by_sku_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_search_by_sku_setting" value="1" '.checked(1,get_option( 'b2bking_search_by_sku_setting', 1 ), false).'">
		</div>
		';	
	}

	function b2bking_search_product_description_setting_description(){
		ob_start();
		echo esc_html__('Search product description', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Also search product descriptions (slower)','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_search_product_description_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_search_product_description_setting" value="1" '.checked(1,get_option( 'b2bking_search_product_description_setting', 0 ), false).'">
		</div>
		';		
	}

	function b2bking_search_each_variation_setting_description(){
		ob_start();
		echo esc_html__('Search each individual variation', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Search for the SKU / name of each variation individually (slower)','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_search_each_variation_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_search_each_variation_setting" value="1" '.checked(1,get_option( 'b2bking_search_each_variation_setting', 1 ), false).'">
		</div>
		';		
	}

	function b2bking_show_accounting_subtotals_setting_description(){
		ob_start();
		echo esc_html__('Show accounting subtotals', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Accurate price display based on store settings (slower)','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_show_accounting_subtotals_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_show_accounting_subtotals_setting" value="1" '.checked(1,get_option( 'b2bking_show_accounting_subtotals_setting', 0 ), false).'">
		</div>
		';		
	}

	function b2bking_show_images_bulk_order_form_setting_description(){
		ob_start();
		echo esc_html__('Show images in order form', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Show images in bulk order form search results','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_show_images_bulk_order_form_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_show_images_bulk_order_form_setting" value="1" '.checked(1,get_option( 'b2bking_show_images_bulk_order_form_setting', 1 ), false).'">
		</div>
		';
	}

	function b2bking_show_b2c_price_setting_description(){
		ob_start();

		$tip = esc_html__('Show both prices to logged in B2B users.','b2bking').'<br><img class="b2bking_tooltip_img" src="https://kingsplugins.com/wp-content/uploads/2024/08/shows-both-prices.webp">';		

		echo esc_html__('Show B2C price to B2B users', 'b2bking').'&nbsp;'.wc_help_tip($tip, false);
		echo '<p class="b2bking_setting_description">'.esc_html__('Show both retail (e.g. RRP) and wholesale price to B2B users','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_show_b2c_price_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_show_b2c_price_setting" value="1" '.checked(1,get_option( 'b2bking_show_b2c_price_setting', 0 ), false).'">
		</div>
		';	
	}

	function b2bking_modify_suffix_vat_setting_description(){
		ob_start();
		echo esc_html__('Modify VAT suffix automatically', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('B2BKing will add "ex. VAT / inc. VAT" to prices based on tax exemption dynamic rules','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_modify_suffix_vat_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_modify_suffix_vat_setting" value="1" '.checked(1,get_option( 'b2bking_modify_suffix_vat_setting', 0 ), false).'">
		</div>
		';	
	}

	function b2bking_show_moq_product_page_setting_description(){
		ob_start();
		echo esc_html__('Show MOQ Externally', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Show Minimum Order Quantity in Archive / Shop / Cat Pages','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_show_moq_product_page_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="b2bking_show_moq_product_page_setting" value="1" '.checked(1,get_option( 'b2bking_show_moq_product_page_setting', 0 ), false).'">
		</div>
		';		
	}

	function b2bking_retail_price_text_setting_description(){
		ob_start();
		echo esc_html__('Retail price text', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Controls price display in the product page with certain settings','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_retail_price_text_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<input type="text" name="b2bking_retail_price_text_setting" value="'.esc_attr(get_option('b2bking_retail_price_text_setting', esc_html__('Retail price','b2bking'))).'">
			</div>
		</div>
		';
	}

	function b2bking_wholesale_price_text_setting_description(){
		ob_start();
		echo esc_html__('Wholesale price text', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Controls price display in the product page with certain settings','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_wholesale_price_text_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<input type="text" name="b2bking_wholesale_price_text_setting" value="'.esc_attr(get_option('b2bking_wholesale_price_text_setting', esc_html__('Wholesale price','b2bking'))).'">
			</div>
		</div>
		';
	}

	function b2bking_inc_vat_text_setting_description(){
		ob_start();
		echo esc_html__('Inc. VAT text', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Controls inc VAT suffix added by B2BKing','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_inc_vat_text_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<input type="text" name="b2bking_inc_vat_text_setting" value="'.esc_attr(get_option('b2bking_inc_vat_text_setting', esc_html__('inc. VAT','b2bking'))).'">
			</div>
		</div>
		';
	}

	function b2bking_ex_vat_text_setting_description(){
		ob_start();
		echo esc_html__('Ex. VAT text', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('Controls ex VAT suffix added by B2BKing','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_ex_vat_text_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<input type="text" name="b2bking_ex_vat_text_setting" value="'.esc_attr(get_option('b2bking_ex_vat_text_setting', esc_html__('ex. VAT','b2bking'))).'">
			</div>
		</div>
		';
	}


	function b2bking_license_email_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<input type="text" class="b2bking_license_field" name="b2bking_license_email_setting" value="'.esc_attr(get_option('b2bking_license_email_setting', '')).'">
			</div>
		</div>
		';
	}


	function b2bking_license_key_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<input type="text" class="b2bking_license_field" name="b2bking_license_key_setting" value="'.esc_attr(get_option('b2bking_license_key_setting', '')).'">
			</div>
		</div>
		';
	}

	
	function b2bking_hide_prices_guests_text_setting_description(){
		ob_start();
		echo esc_html__('Hide prices text', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('What guests see when "Hide prices" is enabled','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_hide_prices_guests_text_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<input type="text" name="b2bking_hide_prices_guests_text_setting" value="'.esc_attr(get_option('b2bking_hide_prices_guests_text_setting', esc_html__('Login to view prices','b2bking'))).'">
			</div>
		</div>
		';
	}

	function b2bking_hide_b2b_site_text_setting_description(){
		ob_start();
		echo esc_html__('Hide shop & products text', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('What guests see when "Hide Shop & Products" is enabled','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_hide_b2b_site_text_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<input type="text" name="b2bking_hide_b2b_site_text_setting" value="'.esc_attr(get_option('b2bking_hide_b2b_site_text_setting', esc_html__('Please login to access the B2B Portal.','b2bking'))).'">
			</div>
		</div>
		';
	}

	function b2bking_hidden_price_dynamic_rule_text_setting_description(){
		ob_start();
		echo esc_html__('Hidden price dynamic rule text', 'b2bking');
		echo '<p class="b2bking_setting_description">'.esc_html__('What users see when "Hidden Price" dynamic rules apply','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_hidden_price_dynamic_rule_text_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<input type="text" name="b2bking_hidden_price_dynamic_rule_text_setting" value="'.esc_attr(get_option('b2bking_hidden_price_dynamic_rule_text_setting', esc_html__('Price is unavailable','b2bking'))).'">
			</div>
		</div>
		';
	}

	function b2bking_purchase_lists_language_setting_description(){
		ob_start();

		$tip = esc_html__('This sets the language of scripts, as they are not otherwise translateable. To translate other plugin areas, see documentation.','b2bking').'<br><img class="b2bking_tooltip_img" src="https://kingsplugins.com/wp-content/uploads/2024/07/lists-language.webp">';

		echo esc_html__('Set Scripts / Lists Language', 'b2bking').'&nbsp;'.wc_help_tip($tip, false);
		echo '<p class="b2bking_setting_description">'.esc_html__('Choose a language for scripts and purchase lists only. This does not translate other plugin areas.','b2bking').'</p>';
		return ob_get_clean();
	}

	function b2bking_purchase_lists_language_setting_content(){
		?>

		<div class="ui fluid search selection dropdown b2bking_purchase_lists_language_setting">
		  <input type="hidden" name="b2bking_purchase_lists_language_setting">
		  <i class="dropdown icon"></i>
		  <div class="default text"><?php esc_html_e('Select Country','b2bking'); ?></div>
		  <div class="menu">
		  <div class="item" data-value="English"><i class="uk flag"></i>English</div>
		  <div class="item" data-value="Afrikaans"><i class="za flag"></i>Afrikaans</div>
		  <div class="item" data-value="Albanian"><i class="al flag"></i>Albanian</div>
		  <div class="item" data-value="Arabic"><i class="dz flag"></i>Arabic</div>
		  <div class="item" data-value="Armenian"><i class="am flag"></i>Armenian</div>
		  <div class="item" data-value="Azerbaijan"><i class="az flag"></i>Azerbaijan</div>
		  <div class="item" data-value="Bangla"><i class="bd flag"></i>Bangla</div>
		  <div class="item" data-value="Basque"><i class="es flag"></i>Basque</div>
		  <div class="item" data-value="Belarusian"><i class="by flag"></i>Belarusian</div>
		  <div class="item" data-value="Bulgarian"><i class="bg flag"></i>Bulgarian</div>
		  <div class="item" data-value="Catalan"><i class="es flag"></i>Catalan</div>
		  <div class="item" data-value="Chinese"><i class="cn flag"></i>Chinese</div>
		  <div class="item" data-value="Chinese-traditional"><i class="cn flag"></i>Chinese Traditional</div>
		  <div class="item" data-value="Croatian"><i class="hr flag"></i>Croatian</div>
		  <div class="item" data-value="Czech"><i class="cz flag"></i>Czech</div>
		  <div class="item" data-value="Danish"><i class="dk flag"></i>Danish</div>
		  <div class="item" data-value="Dutch"><i class="nl flag"></i>Dutch</div>
		  <div class="item" data-value="Estonian"><i class="ee flag"></i>Estonian</div>
		  <div class="item" data-value="Filipino"><i class="ph flag"></i>Filipino</div>
		  <div class="item" data-value="Finnish"><i class="fi flag"></i>Finnish</div>
		  <div class="item" data-value="French"><i class="fr flag"></i>French</div>
		  <div class="item" data-value="Galician"><i class="es flag"></i>Galician</div>
		  <div class="item" data-value="Georgian"><i class="ge flag"></i>Georgian</div>
		  <div class="item" data-value="German"><i class="de flag"></i>German</div>
		  <div class="item" data-value="Greek"><i class="gr flag"></i>Greek</div>
		  <div class="item" data-value="Hebrew"><i class="il flag"></i>Hebrew</div>
		  <div class="item" data-value="Hindi"><i class="in flag"></i>Hindi</div>
		  <div class="item" data-value="Hungarian"><i class="hu flag"></i>Hungarian</div>
		  <div class="item" data-value="Icelandic"><i class="is flag"></i>Icelandic</div>
		  <div class="item" data-value="Indonesian"><i class="id flag"></i>Indonesian</div>
		  <div class="item" data-value="Italian"><i class="it flag"></i>Italian</div>
		  <div class="item" data-value="Japanese"><i class="jp flag"></i>Japanese</div>
		  <div class="item" data-value="Kazakh"><i class="kz flag"></i>Kazakh</div>
		  <div class="item" data-value="Korean"><i class="kr flag"></i>Korean</div>
		  <div class="item" data-value="Kyrgyz"><i class="kg flag"></i>Kyrgyz</div>
		  <div class="item" data-value="Latvian"><i class="lv flag"></i>Latvian</div>
		  <div class="item" data-value="Lithuanian"><i class="lt flag"></i>Lithuanian</div>
		  <div class="item" data-value="Macedonian"><i class="mk flag"></i>Macedonian</div>
		  <div class="item" data-value="Malay"><i class="my flag"></i>Malay</div>
		  <div class="item" data-value="Mongolian"><i class="mn flag"></i>Mongolian</div>
		  <div class="item" data-value="Nepali"><i class="np flag"></i>Nepali</div>
		  <div class="item" data-value="Norwegian"><i class="no flag"></i>Norwegian</div>
		  <div class="item" data-value="Polish"><i class="pl flag"></i>Polish</div>
		  <div class="item" data-value="Portuguese"><i class="pt flag"></i>Portuguese</div>
		  <div class="item" data-value="Romanian"><i class="ro flag"></i>Romanian</div>
		  <div class="item" data-value="Russian"><i class="ru flag"></i>Russian</div>
		  <div class="item" data-value="Serbian"><i class="cs flag"></i>Serbian</div>
		  <div class="item" data-value="Slovak"><i class="sk flag"></i>Slovak</div>
		  <div class="item" data-value="Slovenian"><i class="si flag"></i>Slovenian</div>
		  <div class="item" data-value="Spanish"><i class="es flag"></i>Spanish</div>
		  <div class="item" data-value="Swedish"><i class="se flag"></i>Swedish</div>
		  <div class="item" data-value="Thai"><i class="th flag"></i>Thai</div>
		  <div class="item" data-value="Turkish"><i class="tr flag"></i>Turkish</div>
		  <div class="item" data-value="Ukrainian"><i class="ua flag"></i>Ukrainian</div>
		  <div class="item" data-value="Uzbek"><i class="uz flag"></i>Uzbek</div>
		  <div class="item" data-value="Vietnamese"><i class="vn flag"></i>Vietnamese</div>
		</div>
		 </div>
		<?php	
	}

	
		
	public function render_settings_page_content() {

		add_filter('b2bking_use_classic_icons','__return_false');
		global $b2bking_icons;
		$icons = array(
			'power' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M10 4H14C18.42 4 22 7.58 22 12C22 16.42 18.42 20 14 20H10C5.58 20 2 16.42 2 12C2 7.58 5.58 4 10 4Z" stroke="#f3f4f5" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M14 16C16.2091 16 18 14.2091 18 12C18 9.79086 16.2091 8 14 8C11.7909 8 10 9.79086 10 12C10 14.2091 11.7909 16 14 16Z" stroke="#f3f4f5" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
			'lock' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M6 10V8C6 4.69 7 2 12 2C17 2 18 4.69 18 8V10" stroke="#f3f4f5" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M17 22H7C3 22 2 21 2 17V15C2 11 3 10 7 10H17C21 10 22 11 22 15V17C22 21 21 22 17 22Z" stroke="#f3f4f5" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M15.9965 16H16.0054" stroke="#f3f4f5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M11.9955 16H12.0045" stroke="#f3f4f5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M7.99451 16H8.00349" stroke="#f3f4f5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
			'lock2' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M16 9V6C16 4.34315 14.6569 3 13 3H11C9.34315 3 8 4.34315 8 6V9M16 9H8M16 9C17.6569 9 19 10.3431 19 12V18C19 19.6569 17.6569 21 16 21H8C6.34315 21 5 19.6569 5 18V12C5 10.3431 6.34315 9 8 9M12 14V17M13 14C13 14.5523 12.5523 15 12 15C11.4477 15 11 14.5523 11 14C11 13.4477 11.4477 13 12 13C12.5523 13 13 13.4477 13 14Z" stroke="#f3f4f5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
			'users' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M3.41003 22C3.41003 18.13 7.26003 15 12 15C12.96 15 13.89 15.13 14.76 15.37" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M22 18C22 18.75 21.79 19.46 21.42 20.06C21.21 20.42 20.94 20.74 20.63 21C19.93 21.63 19.01 22 18 22C16.54 22 15.27 21.22 14.58 20.06C14.21 19.46 14 18.75 14 18C14 16.74 14.58 15.61 15.5 14.88C16.19 14.33 17.06 14 18 14C20.21 14 22 15.79 22 18Z" stroke="#f3f4f5" stroke-width="0.85" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M16.4399 18L17.4299 18.99L19.5599 17.02" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
			'users2' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M14 18L16 20L22 14M4 20V19C4 16.2386 6.23858 14 9 14H12.75M15 7C15 9.20914 13.2091 11 11 11C8.79086 11 7 9.20914 7 7C7 4.79086 8.79086 3 11 3C13.2091 3 15 4.79086 15 7Z" stroke="#f3f4f5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
			'bulkorder' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12.37 8.87988H17.62" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M6.38 8.87988L7.13 9.62988L9.38 7.37988" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M12.37 15.8799H17.62" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M6.38 15.8799L7.13 16.6299L9.38 14.3799" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
			'bulkorder2' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M11 19.5H21" stroke="#e2e5ea" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M11 12.5H21" stroke="#e2e5ea" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M11 5.5H21" stroke="#e2e5ea" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M3 5.5L4 6.5L7 3.5" stroke="#e2e5ea" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M3 12.5L4 13.5L7 10.5" stroke="#e2e5ea" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M3 19.5L4 20.5L7 17.5" stroke="#e2e5ea" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
			'tiered' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#f3f4f5"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M6.87988 18.1501V16.0801" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round"></path> <path d="M12 18.15V14.01" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round"></path> <path d="M17.1201 18.1499V11.9299" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round"></path> <path d="M17.1199 5.8501L16.6599 6.3901C14.1099 9.3701 10.6899 11.4801 6.87988 12.4301" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round"></path> <path d="M14.1899 5.8501H17.1199V8.7701" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
			'quotesoffers' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M21 7V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V7C3 4 4.5 2 8 2H16C19.5 2 21 4 21 7Z" stroke="#f3f4f5" stroke-width="0.85" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M15.5 2V9.85999C15.5 10.3 14.98 10.52 14.66 10.23L12.34 8.09003C12.15 7.91003 11.85 7.91003 11.66 8.09003L9.34003 10.23C9.02003 10.52 8.5 10.3 8.5 9.85999V2H15.5Z" stroke="#f3f4f5" stroke-width="0.85" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M13.25 14H17.5" stroke="#f3f4f5" stroke-width="0.85" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M9 18H17.5" stroke="#f3f4f5" stroke-width="0.85" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
			'quotesoffers2' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <rect x="3" y="3" width="18" height="18" rx="3" stroke="#f3f4f5" stroke-width="1.128" stroke-linecap="round" stroke-linejoin="round"></rect> <path d="M9 3V9L12 7L15 9V3" stroke="#f3f4f5" stroke-width="1.128" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
			'quotesoffers3' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M3 3H4.37144C5.31982 3 6.13781 3.66607 6.32996 4.59479L8.67004 15.9052C8.86219 16.8339 9.68018 17.5 10.6286 17.5H17.5" stroke="#f3f4f5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M6.82422 7H19.6743C20.3386 7 20.8183 7.6359 20.6358 8.27472L19.6217 11.8242C19.2537 13.1121 18.0765 14 16.7371 14H8.27734" stroke="#f3f4f5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> <circle cx="16.5" cy="20.5" r="0.5" fill="#f3f4f5" stroke="#f3f4f5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></circle> <circle cx="0.5" cy="0.5" r="0.5" transform="matrix(1 0 0 -1 10 21)" fill="#f3f4f5" stroke="#f3f4f5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></circle> </g></svg>',
			'language' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M19.06 18.6699L16.92 14.3999L14.78 18.6699" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M15.1699 17.9099H18.6899" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M16.9201 22.0001C14.1201 22.0001 11.8401 19.73 11.8401 16.92C11.8401 14.12 14.1101 11.8401 16.9201 11.8401C19.7201 11.8401 22.0001 14.11 22.0001 16.92C22.0001 19.73 19.7301 22.0001 16.9201 22.0001Z" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M5.02 2H8.94C11.01 2 12.01 3.00002 11.96 5.02002V8.94C12.01 11.01 11.01 12.01 8.94 11.96H5.02C3 12 2 11 2 8.92999V5.01001C2 3.00001 3 2 5.02 2Z" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M9.00995 5.84985H4.94995" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M6.96997 5.16992V5.84991" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M7.98994 5.83984C7.98994 7.58984 6.61994 9.00983 4.93994 9.00983" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M9.0099 9.01001C8.2799 9.01001 7.61991 8.62 7.15991 8" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M2 15C2 18.87 5.13 22 9 22L7.95 20.25" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M22 9C22 5.13 18.87 2 15 2L16.05 3.75" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
			'language2' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M16.99 8.95996H7.01001" stroke="#f3f4f5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M12 7.28003V8.96002" stroke="#f3f4f5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M14.5 8.93994C14.5 13.2399 11.14 16.7199 7 16.7199" stroke="#f3f4f5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M16.9999 16.72C15.1999 16.72 13.6 15.76 12.45 14.25" stroke="#f3f4f5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#f3f4f5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
			'credit' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M2.5 13.24V11.51C2.5 9.44001 4.18999 7.75 6.25999 7.75H17.74C19.81 7.75 21.5 9.44001 21.5 11.51V12.95H19.48C18.92 12.95 18.41 13.17 18.04 13.55C17.62 13.96 17.38 14.55 17.44 15.18C17.53 16.26 18.52 17.05 19.6 17.05H21.5V18.24C21.5 20.31 19.81 22 17.74 22H12.26" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M2.5 12.4101V7.8401C2.5 6.6501 3.23 5.59006 4.34 5.17006L12.28 2.17006C13.52 1.70006 14.85 2.62009 14.85 3.95009V7.75008" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M22.5588 13.9702V16.0302C22.5588 16.5802 22.1188 17.0302 21.5588 17.0502H19.5988C18.5188 17.0502 17.5288 16.2602 17.4388 15.1802C17.3788 14.5502 17.6188 13.9602 18.0388 13.5502C18.4088 13.1702 18.9188 12.9502 19.4788 12.9502H21.5588C22.1188 12.9702 22.5588 13.4202 22.5588 13.9702Z" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M7 12H14" stroke="#f3f4f5" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M3 16.5H8.34C8.98 16.5 9.5 17.02 9.5 17.66V18.94" stroke="#f3f4f5" stroke-width="0.85" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M4.22 15.28L3 16.5L4.22 17.72" stroke="#f3f4f5" stroke-width="0.85" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M9.5 21.7801H4.16C3.52 21.7801 3 21.2601 3 20.6201V19.3401" stroke="#f3f4f5" stroke-width="0.85" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M8.28125 23.0003L9.50125 21.7803L8.28125 20.5603" stroke="#f3f4f5" stroke-width="0.85" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
			'other' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="#f3f4f5" stroke-width="1.2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M2 12.8799V11.1199C2 10.0799 2.85 9.21994 3.9 9.21994C5.71 9.21994 6.45 7.93994 5.54 6.36994C5.02 5.46994 5.33 4.29994 6.24 3.77994L7.97 2.78994C8.76 2.31994 9.78 2.59994 10.25 3.38994L10.36 3.57994C11.26 5.14994 12.74 5.14994 13.65 3.57994L13.76 3.38994C14.23 2.59994 15.25 2.31994 16.04 2.78994L17.77 3.77994C18.68 4.29994 18.99 5.46994 18.47 6.36994C17.56 7.93994 18.3 9.21994 20.11 9.21994C21.15 9.21994 22.01 10.0699 22.01 11.1199V12.8799C22.01 13.9199 21.16 14.7799 20.11 14.7799C18.3 14.7799 17.56 16.0599 18.47 17.6299C18.99 18.5399 18.68 19.6999 17.77 20.2199L16.04 21.2099C15.25 21.6799 14.23 21.3999 13.76 20.6099L13.65 20.4199C12.75 18.8499 11.27 18.8499 10.36 20.4199L10.25 20.6099C9.78 21.3999 8.76 21.6799 7.97 21.2099L6.24 20.2199C5.33 19.6999 5.02 18.5299 5.54 17.6299C6.45 16.0599 5.71 14.7799 3.9 14.7799C2.85 14.7799 2 13.9199 2 12.8799Z" stroke="#f3f4f5" stroke-width="1.2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
			'key' => '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M19.79 14.9299C17.73 16.9799 14.78 17.6099 12.19 16.7999L7.48002 21.4999C7.14002 21.8499 6.47002 22.0599 5.99002 21.9899L3.81002 21.6899C3.09002 21.5899 2.42002 20.9099 2.31002 20.1899L2.01002 18.0099C1.94002 17.5299 2.17002 16.8599 2.50002 16.5199L7.20002 11.8199C6.40002 9.21995 7.02002 6.26995 9.08002 4.21995C12.03 1.26995 16.82 1.26995 19.78 4.21995C22.74 7.16995 22.74 11.9799 19.79 14.9299Z" stroke="#f3f4f5" stroke-width="1.2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M6.89001 17.49L9.19001 19.79" stroke="#f3f4f5" stroke-width="1.2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M14.5 11C15.3284 11 16 10.3284 16 9.5C16 8.67157 15.3284 8 14.5 8C13.6716 8 13 8.67157 13 9.5C13 10.3284 13.6716 11 14.5 11Z" stroke="#f3f4f5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',
		);

		update_option('b2bking_icons', $icons);

		?>

		<!-- Admin Menu Page Content -->
		<form id="b2bking_admin_form" method="POST" action="options.php">
			<?php settings_fields('b2bking'); ?>
			<?php do_settings_fields( 'b2bking', 'b2bking_hiddensettings' ); ?>

			<div id="b2bking_admin_wrapper" >

				<!-- Admin Menu Tabs --> 
				<div id="b2bking_admin_menu" class="ui labeled stackable large vertical menu attached">
					<img id="b2bking_menu_logo" src="<?php 

					$custom_logo = 'no';
					if (defined('B2BKINGLABEL_DIR')){
						if (!empty(get_option('b2bking_whitelabel_logo_setting',''))){
							$custom_logo = get_option('b2bking_whitelabel_logo_setting','');
						}
					}

					if ($custom_logo === 'no'){
						$custom_logo = plugins_url('../includes/assets/images/logo.png', __FILE__);
					}
					
					echo $custom_logo; 

					?>">
					<a class="green item <?php echo $this->b2bking_isactivetab('mainsettings'); ?>" data-tab="mainsettings">
						<i class="<?php echo apply_filters('b2bking_use_classic_icons', 'power off');?> icon"><?php echo $icons['power'];?></i>
						<div class="header"><?php esc_html_e('Main Settings','b2bking'); ?></div>
						<span class="b2bking_menu_description"><?php esc_html_e('Primary plugin settings','b2bking'); ?></span>
					</a>
					<a class="green item <?php echo $this->b2bking_isactivetab('accessrestriction'); ?>" data-tab="accessrestriction">
						<i class="<?php echo apply_filters('b2bking_use_classic_icons', 'lock');?> icon"><?php echo $icons['lock2'];?></i>
						<div class="header"><?php esc_html_e('Access Restriction','b2bking'); ?></div>
						<span class="b2bking_menu_description"><?php esc_html_e('Hide pricing & products','b2bking'); ?></span>
					</a>
					<a class="green item <?php echo $this->b2bking_isactivetab('registration'); ?>" data-tab="registration">
						<i class="<?php echo apply_filters('b2bking_use_classic_icons', 'users');?> icon"><?php echo $icons['users2'];?></i>
						<div class="header"><?php esc_html_e('Registration','b2bking'); ?></div>
						<span class="b2bking_menu_description"><?php esc_html_e('Registration settings','b2bking'); ?></span>
					</a>
					<a class="green item <?php echo $this->b2bking_isactivetab('bulkorderform'); ?>" data-tab="bulkorderform">
						<i class="<?php echo apply_filters('b2bking_use_classic_icons', 'th list');?> icon"><?php echo $icons['bulkorder2'];?></i>
						<div class="header"><?php esc_html_e('Bulk Order Form','b2bking'); ?></div>
						<span class="b2bking_menu_description"><?php esc_html_e('Order form settings','b2bking'); ?></span>
					</a>
					<a class="green item <?php echo $this->b2bking_isactivetab('tieredpricing'); ?>" data-tab="tieredpricing">
						<i class="<?php echo apply_filters('b2bking_use_classic_icons', 'table');?> icon"><?php echo $icons['tiered'];?></i>
						<div class="header"><?php esc_html_e('Tiered Pricing','b2bking'); ?></div>
						<span class="b2bking_menu_description"><?php esc_html_e('Tiered price settings','b2bking'); ?></span>
					</a>
					<a class="green item <?php echo $this->b2bking_isactivetab('quotesoffers'); ?>" data-tab="quotesoffers">
						<i class="<?php echo apply_filters('b2bking_use_classic_icons', 'table');?> icon"><?php echo $icons['quotesoffers'];?></i>
						<div class="header"><?php esc_html_e('Quotes & Offers','b2bking'); ?></div>
					</a>
					<a class="green item <?php echo $this->b2bking_isactivetab('language'); ?>" data-tab="language">
						<i class="<?php echo apply_filters('b2bking_use_classic_icons', 'language');?> icon"><?php echo $icons['language'];?></i>
						<div class="header"><?php esc_html_e('Language and Text','b2bking'); ?></div>
						<span class="b2bking_menu_description"><?php esc_html_e('Strings & language settings','b2bking'); ?></span>
					</a>
					<?php
					do_action('b2bking_settings_panel_end_items');
					?>
					<a class="green item <?php 
						echo $this->b2bking_isactivetab('othersettings'); 
						if (!apply_filters('b2bking_license_show', true)){ echo ' b2bking_othersettings_margin'; }
					?>" data-tab="othersettings">
						<i class="<?php echo apply_filters('b2bking_use_classic_icons', 'cog');?> icon"><?php echo $icons['other'];?></i>
						<div class="header"><?php esc_html_e('Other & Advanced','b2bking'); ?></div>
						<span class="b2bking_menu_description"><?php esc_html_e('Miscellaneous settings','b2bking'); ?></span>
					</a>

					<?php
					if (apply_filters('b2bking_license_show', true)){
						?>
						<a class="green item b2bking_license b2bking_othersettings_margin <?php  echo $this->b2bking_isactivetab('license'); ?>" data-tab="license">
							<i class="<?php echo apply_filters('b2bking_use_classic_icons', 'key');?> icon"><?php echo $icons['key'];?></i>
							<div class="header"><?php  esc_html_e('License','b2bking'); ?></div>
							<span class="b2bking_menu_description"><?php esc_html_e('Manage plugin license','b2bking'); ?></span>
						</a>
						<?php
					}
					?>
					
					

				
				</div>
			
				<!-- Admin Menu Tabs Content--> 
				<div id="b2bking_tabs_wrapper">

					<!-- Main Settings Tab--> 
					<div class="ui bottom attached tab segment b2bking_enablefeatures_tab <?php echo $this->b2bking_isactivetab('mainsettings'); ?>" data-tab="mainsettings">
						<div class="b2bking_attached_content_wrapper">
							<h2 class="ui block header" style="display: flex;">
								<i class="icon"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="position: relative;bottom: 2px;width: 36px !important;
								"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M10 4H14C18.42 4 22 7.58 22 12C22 16.42 18.42 20 14 20H10C5.58 20 2 16.42 2 12C2 7.58 5.58 4 10 4Z" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M14 16C16.2091 16 18 14.2091 18 12C18 9.79086 16.2091 8 14 8C11.7909 8 10 9.79086 10 12C10 14.2091 11.7909 16 14 16Z" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg></i>
								<div class="content">
									<?php esc_html_e('Main Settings','b2bking'); ?>
								</div>
							</h2>
							<table class="form-table">
								<?php
								if (!defined('B2BKINGLABEL_DIR')){
									?>
									<div class="ui ignored info icon message">
								      <div class="content">
								        <h3 class="header">	<?php esc_html_e('Documentation','b2bking'); ?></h3>
								        <p>
								            <?php
								            $learn_more_link = '<a href="https://woocommerce-b2b-plugin.com/docs/plugin-status/" target="_blank" style="color: #295b6b"><span style="color: #295b6b">&nbsp;<strong style="text-decoration: underline;">%s</strong></span></a>';

								            $translated_text = sprintf(
								                /* translators: %s: Linked text for 'Learn more' */
								                esc_html__('In B2B shop mode, plugin features are visible to all users. In B2B & B2C hybrid mode, features are available only to designated B2B users. %s', 'b2bking'),
								                sprintf($learn_more_link, esc_html__('Learn more', 'b2bking'))
								            );

								            echo wp_kses($translated_text, array(
								                'a' => array(
								                    'href' => array(),
								                    'target' => array(),
								                    'style' => array()
								                ),
								                'span' => array(
								                    'style' => array()
								                ),
								                'strong' => array(
								                    'style' => array()
								                )
								            ));
								            ?>
								        </p>
								      </div>
								      <svg viewBox="0 0 24 24" fill="#333" xmlns="http://www.w3.org/2000/svg" style="width: 50px;"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M6.27103 2.11151C5.46135 2.21816 5.03258 2.41324 4.72718 2.71244C4.42179 3.01165 4.22268 3.43172 4.11382 4.225C4.00176 5.04159 4 6.12387 4 7.67568V16.2442C4.38867 15.9781 4.82674 15.7756 5.29899 15.6517C5.82716 15.513 6.44305 15.5132 7.34563 15.5135L20 15.5135V7.67568C20 6.12387 19.9982 5.04159 19.8862 4.22499C19.7773 3.43172 19.5782 3.01165 19.2728 2.71244C18.9674 2.41324 18.5387 2.21816 17.729 2.11151C16.8955 2.00172 15.7908 2 14.2069 2H9.7931C8.2092 2 7.10452 2.00172 6.27103 2.11151ZM6.75862 6.59459C6.75862 6.1468 7.12914 5.78378 7.58621 5.78378H16.4138C16.8709 5.78378 17.2414 6.1468 17.2414 6.59459C17.2414 7.04239 16.8709 7.40541 16.4138 7.40541H7.58621C7.12914 7.40541 6.75862 7.04239 6.75862 6.59459ZM7.58621 9.56757C7.12914 9.56757 6.75862 9.93058 6.75862 10.3784C6.75862 10.8262 7.12914 11.1892 7.58621 11.1892H13.1034C13.5605 11.1892 13.931 10.8262 13.931 10.3784C13.931 9.93058 13.5605 9.56757 13.1034 9.56757H7.58621Z" fill="#6aacc0"></path> <path d="M8.68965 17.1351H7.47341C6.39395 17.1351 6.01657 17.1421 5.72738 17.218C4.93365 17.4264 4.30088 18.0044 4.02952 18.7558C4.0463 19.1382 4.07259 19.4746 4.11382 19.775C4.22268 20.5683 4.42179 20.9884 4.72718 21.2876C5.03258 21.5868 5.46135 21.7818 6.27103 21.8885C7.10452 21.9983 8.2092 22 9.7931 22H14.2069C15.7908 22 16.8955 21.9983 17.729 21.8885C18.5387 21.7818 18.9674 21.5868 19.2728 21.2876C19.5782 20.9884 19.7773 20.5683 19.8862 19.775C19.9776 19.1088 19.9956 18.2657 19.9991 17.1351H13.1034V20.1417C13.1034 20.4397 13.1034 20.5886 12.9988 20.6488C12.8941 20.709 12.751 20.6424 12.4647 20.5092L11.0939 19.8713C10.9971 19.8262 10.9486 19.8037 10.8966 19.8037C10.8445 19.8037 10.796 19.8262 10.6992 19.8713L9.32842 20.5092C9.04213 20.6424 8.89899 20.709 8.79432 20.6488C8.68965 20.5886 8.68965 20.4397 8.68965 20.1417V17.1351Z" fill="#6aacc0"></path></g></svg>
									</div>

									<?php
								}
								?>
								<div class="ui large form b2bking_plugin_status_container">
								  <div class="inline fields">
								    <label><?php esc_html_e('Plugin Status','b2bking'); ?></label>&nbsp;&nbsp;
								    <div class="field">
								      <div class="ui checkbox">
								        <input type="radio" tabindex="0" class="hidden" name="b2bking_plugin_status_setting" value="hybrid" <?php checked('hybrid',get_option( 'b2bking_plugin_status_setting', 'b2b' ), true); ?>">
								        <label><i class="shopping basket icon"></i>&nbsp;<?php esc_html_e('B2B & B2C Hybrid Shop','b2bking'); ?>&nbsp;&nbsp;</label>
								      </div>
								    </div>
								    <div class="field">
								      <div class="ui checkbox">
								        <input type="radio" tabindex="0" class="hidden" name="b2bking_plugin_status_setting" value="b2b" <?php checked('b2b',get_option( 'b2bking_plugin_status_setting', 'b2b' ), true); ?>">
								        <label><i class="dolly icon"></i>&nbsp;<?php esc_html_e('B2B Shop','b2bking'); ?>&nbsp;&nbsp;</label>
								      </div>
								    </div>
								    
								  </div>
								</div>
							</table>
							<h3 class="ui top attached block header">
								<i class="plug icon"></i>
								<?php esc_html_e('Enable / Disable Features','b2bking'); ?>
							</h3>
							<table class="form-table">
								<?php do_settings_fields( 'b2bking', 'b2bking_enable_features_settings_section' ); ?>
							</table>


					
							
						</div>
					</div>
					
					<!-- Access Restriction Tab--> 
					<div class="ui bottom attached tab segment accessrestriction <?php echo $this->b2bking_isactivetab('accessrestriction'); ?>" data-tab="accessrestriction">
						<div class="b2bking_attached_content_wrapper">
							<h2 class="ui block header">
								<svg style="position: relative;top: 2px;width: 48px;margin-right: 4px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path stroke-linejoin="round" stroke-linecap="round" stroke-width="2" stroke="#333" d="M16 9V6C16 4.34315 14.6569 3 13 3H11C9.34315 3 8 4.34315 8 6V9M16 9H8M16 9C17.6569 9 19 10.3431 19 12V18C19 19.6569 17.6569 21 16 21H8C6.34315 21 5 19.6569 5 18V12C5 10.3431 6.34315 9 8 9M12 14V17M13 14C13 14.5523 12.5523 15 12 15C11.4477 15 11 14.5523 11 14C11 13.4477 11.4477 13 12 13C12.5523 13 13 13.4477 13 14Z"></path> </g></svg>
								<div class="content">
									<?php esc_html_e('Access Restriction','b2bking'); ?>
									<div class="sub header">
										<?php esc_html_e('Hide prices & products','b2bking'); ?>
									</div>
								</div>
							</h2>
							<?php
							if (!defined('B2BKINGLABEL_DIR')){
								?>
								<div class="ui ignored info icon message">
							      <div class="content">
							        <h3 class="header">	<?php esc_html_e('Documentation','b2bking'); ?></h3>
							        <p>
							            <?php
							            $guest_access_link = '<a href="https://woocommerce-b2b-plugin.com/docs/guest-access-restriction-hide-prices-hide-the-website-replace-prices-with-quote-request/" target="_blank" style="color: #295b6b"><span style="color: #295b6b">&nbsp;<strong style="text-decoration: underline;">%s</strong></span></a>';

							            $translated_text = sprintf(
							                /* translators: %s: Linked text for 'guest access restriction' */
							                esc_html__('Control what logged out users (guests) see through the available %s options.', 'b2bking'),
							                sprintf($guest_access_link, esc_html__('guest access restriction', 'b2bking'))
							            );

							            echo wp_kses($translated_text, array(
							                'a' => array(
							                    'href' => array(),
							                    'target' => array(),
							                    'style' => array()
							                ),
							                'span' => array(
							                    'style' => array()
							                ),
							                'strong' => array(
							                    'style' => array()
							                )
							            ));
							            ?>
							        </p>
							      </div>
							      <svg viewBox="0 0 24 24" fill="#333" xmlns="http://www.w3.org/2000/svg" style="width: 50px;"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M6.27103 2.11151C5.46135 2.21816 5.03258 2.41324 4.72718 2.71244C4.42179 3.01165 4.22268 3.43172 4.11382 4.225C4.00176 5.04159 4 6.12387 4 7.67568V16.2442C4.38867 15.9781 4.82674 15.7756 5.29899 15.6517C5.82716 15.513 6.44305 15.5132 7.34563 15.5135L20 15.5135V7.67568C20 6.12387 19.9982 5.04159 19.8862 4.22499C19.7773 3.43172 19.5782 3.01165 19.2728 2.71244C18.9674 2.41324 18.5387 2.21816 17.729 2.11151C16.8955 2.00172 15.7908 2 14.2069 2H9.7931C8.2092 2 7.10452 2.00172 6.27103 2.11151ZM6.75862 6.59459C6.75862 6.1468 7.12914 5.78378 7.58621 5.78378H16.4138C16.8709 5.78378 17.2414 6.1468 17.2414 6.59459C17.2414 7.04239 16.8709 7.40541 16.4138 7.40541H7.58621C7.12914 7.40541 6.75862 7.04239 6.75862 6.59459ZM7.58621 9.56757C7.12914 9.56757 6.75862 9.93058 6.75862 10.3784C6.75862 10.8262 7.12914 11.1892 7.58621 11.1892H13.1034C13.5605 11.1892 13.931 10.8262 13.931 10.3784C13.931 9.93058 13.5605 9.56757 13.1034 9.56757H7.58621Z" fill="#6aacc0"></path> <path d="M8.68965 17.1351H7.47341C6.39395 17.1351 6.01657 17.1421 5.72738 17.218C4.93365 17.4264 4.30088 18.0044 4.02952 18.7558C4.0463 19.1382 4.07259 19.4746 4.11382 19.775C4.22268 20.5683 4.42179 20.9884 4.72718 21.2876C5.03258 21.5868 5.46135 21.7818 6.27103 21.8885C7.10452 21.9983 8.2092 22 9.7931 22H14.2069C15.7908 22 16.8955 21.9983 17.729 21.8885C18.5387 21.7818 18.9674 21.5868 19.2728 21.2876C19.5782 20.9884 19.7773 20.5683 19.8862 19.775C19.9776 19.1088 19.9956 18.2657 19.9991 17.1351H13.1034V20.1417C13.1034 20.4397 13.1034 20.5886 12.9988 20.6488C12.8941 20.709 12.751 20.6424 12.4647 20.5092L11.0939 19.8713C10.9971 19.8262 10.9486 19.8037 10.8966 19.8037C10.8445 19.8037 10.796 19.8262 10.6992 19.8713L9.32842 20.5092C9.04213 20.6424 8.89899 20.709 8.79432 20.6488C8.68965 20.5886 8.68965 20.4397 8.68965 20.1417V17.1351Z" fill="#6aacc0"></path></g></svg>
								</div>

								<?php
							}
							?>

							<table class="form-table">
								<div class="ui large form b2bking_plugin_status_container">
									<label class="b2bking_access_restriction_label"><?php esc_html_e('Guest Access Restriction','b2bking'); ?></label>

								  <div class="inline fields">
								    <div class="field">
								      <div class="ui checkbox">
								        <input type="radio" tabindex="0" class="hidden" name="b2bking_guest_access_restriction_setting" value="none" <?php checked('none', get_option( 'b2bking_guest_access_restriction_setting', 'hide_prices' ), true); ?>">
								        <label><?php esc_html_e('None','b2bking'); ?></label>
								      </div>
								    </div>
								    <div class="field">
								      <div class="ui checkbox">
								        <input type="radio" tabindex="0" class="hidden" name="b2bking_guest_access_restriction_setting" value="hide_prices" <?php checked('hide_prices', get_option( 'b2bking_guest_access_restriction_setting', 'hide_prices' ), true); ?>">
								        <label><i class="euro sign icon"></i><?php esc_html_e('Hide prices','b2bking'); ?></label>
								      </div>
								    </div>
								    <div class="field">
								      <div class="ui checkbox">
								        <input type="radio" tabindex="0" class="hidden" name="b2bking_guest_access_restriction_setting" value="hide_website" <?php checked('hide_website', get_option( 'b2bking_guest_access_restriction_setting', 'hide_prices' ), true); ?>">
								        <label><i class="building outline icon"></i><?php esc_html_e('Hide shop & products','b2bking'); ?></label>
								      </div>
								    </div>
								    <div class="field">
								      <div class="ui checkbox">
								        <input type="radio" tabindex="0" class="hidden" name="b2bking_guest_access_restriction_setting" value="hide_website_completely" <?php checked('hide_website_completely', get_option( 'b2bking_guest_access_restriction_setting', 'hide_prices' ), true); ?>">
								        <label><i class="lock icon"></i><?php esc_html_e('Hide website / force login','b2bking'); ?></label>
								      </div>
								    </div>
								    <div class="field">
								      <div class="ui checkbox">
								        <input type="radio" tabindex="0" class="hidden" name="b2bking_guest_access_restriction_setting" value="replace_prices_quote" <?php checked('replace_prices_quote', get_option( 'b2bking_guest_access_restriction_setting', 'hide_prices' ), true); ?>">
								        <label><i class="clipboard outline icon"></i><?php esc_html_e('Replace prices with "Request a Quote"','b2bking'); ?></label>
								      </div>
								    </div>
								  </div>

								</div>
							</table>
							<table class="form-table" id="b2bking_access_restriction_force_redirect">
								<?php do_settings_fields( 'b2bking', 'b2bking_access_restriction_settings_force_section' ); ?>
							</table>

							<br>
							<table class="form-table b2bking_visibility_settings">
								<h3 class="ui top attached block header">
									<i class="eye icon"></i>
									<?php esc_html_e('Product & Category Visibility','b2bking'); ?>
								</h3>
								<?php do_settings_fields( 'b2bking', 'b2bking_access_restriction_settings_section' ); ?>
							</table>
							<?php
							if (!defined('B2BKINGLABEL_DIR')){
								?>
								<div class="ui ignored info icon message b2bking_visibility_instructions_message">
							      <div class="content">
							        <h3 class="header">	<?php esc_html_e('Next steps...','b2bking'); ?></h3>
							        <p>
							            <?php
							            $visibility_guide_link = '<a href="https://woocommerce-b2b-plugin.com/docs/faq-product-visibility-is-not-working-how-to-set-up-product-visibility/" target="_blank" style="color: #295b6b"><span>&nbsp;<i class="book icon"></i><strong style="text-decoration: underline;">%s</strong></span></a>';

							            $translated_text = sprintf(
							                /* translators: %s: Linked text for 'how to set up visibility' */
							                esc_html__('Go to each product or category and configure visibility, or read our %s guide.', 'b2bking'),
							                sprintf($visibility_guide_link, esc_html__('how to set up visibility', 'b2bking'))
							            );

							            echo wp_kses($translated_text, array(
							                'a' => array(
							                    'href' => array(),
							                    'target' => array(),
							                    'style' => array()
							                ),
							                'span' => array(
							                    'style' => array()
							                ),
							                'strong' => array(
							                    'style' => array()
							                ),
							                'i' => array(
							                    'class' => array()
							                )
							            ));
							            ?>
							        </p>
							      </div>
							      <svg width="50px" height="50px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z" stroke="#0e566c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M18.3801 15.27V7.57999C18.3801 6.80999 17.7601 6.25 17.0001 6.31H16.9601C15.6201 6.42 13.5901 7.11001 12.4501 7.82001L12.3401 7.89002C12.1601 8.00002 11.8501 8.00002 11.6601 7.89002L11.5001 7.79001C10.3701 7.08001 8.34012 6.40999 7.00012 6.29999C6.24012 6.23999 5.62012 6.81001 5.62012 7.57001V15.27C5.62012 15.88 6.1201 16.46 6.7301 16.53L6.9101 16.56C8.2901 16.74 10.4301 17.45 11.6501 18.12L11.6801 18.13C11.8501 18.23 12.1301 18.23 12.2901 18.13C13.5101 17.45 15.6601 16.75 17.0501 16.56L17.2601 16.53C17.8801 16.46 18.3801 15.89 18.3801 15.27Z" stroke="#0e566c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M12 8.1001V17.6601" stroke="#0e566c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
								</div>
								<?php
							}
							?>

							
						</div>
					</div>

					<!-- Registration Tab--> 
					<div class="ui bottom attached tab segment b2bking_registrationsettings_tab <?php echo $this->b2bking_isactivetab('registration'); ?>" data-tab="registration">
						<div class="b2bking_attached_content_wrapper">
							<h2 class="ui block header">
								<i class="users icon"></i>
								<div class="content">
									<?php esc_html_e('Registration','b2bking'); ?>
									<div class="sub header">
										<?php esc_html_e('User registration settings','b2bking'); ?>
									</div>
								</div>
							</h2>
							<table class="form-table">
								<?php
								if (!defined('B2BKINGLABEL_DIR')){
									?>
									<div class="ui ignored info icon message" style="position: relative; top: -10px;">
								      <div class="content">
								        <h3 class="header">	<?php esc_html_e('Documentation','b2bking'); ?></h3>
									    <p>
									        <?php
									        $separate_registration_link = '<a href="https://woocommerce-b2b-plugin.com/docs/how-to-completely-separate-b2b-and-b2c-registration-in-woocommerce-with-b2bking/" target="_blank" style="color: #295b6b"><span style="color: #295b6b">&nbsp;<strong style="text-decoration: underline;">%s</strong></span></a>';
									        
									        $extended_registration_link = '<a href="https://woocommerce-b2b-plugin.com/docs/extended-registration-and-custom-fields/" target="_blank" style="color: #295b6b"><span style="color: #295b6b"><strong style="text-decoration: underline;">%s</strong></span></a>';

									        $translated_text = sprintf(
									            /* translators: %1$s: Linked text for 'completely separate B2B and B2C registration', %2$s: Linked text for 'extended registration and custom fields' */
									            esc_html__('Learn how to %1$s or read more about the %2$s functionalities.', 'b2bking'),
									            sprintf($separate_registration_link, esc_html__('completely separate B2B and B2C registration', 'b2bking')),
									            sprintf($extended_registration_link, esc_html__('extended registration and custom fields', 'b2bking'))
									        );

									        echo wp_kses($translated_text, array(
									            'a' => array(
									                'href' => array(),
									                'target' => array(),
									                'style' => array()
									            ),
									            'span' => array(
									                'style' => array()
									            ),
									            'strong' => array(
									                'style' => array()
									            )
									        ));
									        ?>
									    </p>

								      </div>
								      <svg viewBox="0 0 24 24" fill="#333" xmlns="http://www.w3.org/2000/svg" style="width: 50px;"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M6.27103 2.11151C5.46135 2.21816 5.03258 2.41324 4.72718 2.71244C4.42179 3.01165 4.22268 3.43172 4.11382 4.225C4.00176 5.04159 4 6.12387 4 7.67568V16.2442C4.38867 15.9781 4.82674 15.7756 5.29899 15.6517C5.82716 15.513 6.44305 15.5132 7.34563 15.5135L20 15.5135V7.67568C20 6.12387 19.9982 5.04159 19.8862 4.22499C19.7773 3.43172 19.5782 3.01165 19.2728 2.71244C18.9674 2.41324 18.5387 2.21816 17.729 2.11151C16.8955 2.00172 15.7908 2 14.2069 2H9.7931C8.2092 2 7.10452 2.00172 6.27103 2.11151ZM6.75862 6.59459C6.75862 6.1468 7.12914 5.78378 7.58621 5.78378H16.4138C16.8709 5.78378 17.2414 6.1468 17.2414 6.59459C17.2414 7.04239 16.8709 7.40541 16.4138 7.40541H7.58621C7.12914 7.40541 6.75862 7.04239 6.75862 6.59459ZM7.58621 9.56757C7.12914 9.56757 6.75862 9.93058 6.75862 10.3784C6.75862 10.8262 7.12914 11.1892 7.58621 11.1892H13.1034C13.5605 11.1892 13.931 10.8262 13.931 10.3784C13.931 9.93058 13.5605 9.56757 13.1034 9.56757H7.58621Z" fill="#6aacc0"></path> <path d="M8.68965 17.1351H7.47341C6.39395 17.1351 6.01657 17.1421 5.72738 17.218C4.93365 17.4264 4.30088 18.0044 4.02952 18.7558C4.0463 19.1382 4.07259 19.4746 4.11382 19.775C4.22268 20.5683 4.42179 20.9884 4.72718 21.2876C5.03258 21.5868 5.46135 21.7818 6.27103 21.8885C7.10452 21.9983 8.2092 22 9.7931 22H14.2069C15.7908 22 16.8955 21.9983 17.729 21.8885C18.5387 21.7818 18.9674 21.5868 19.2728 21.2876C19.5782 20.9884 19.7773 20.5683 19.8862 19.775C19.9776 19.1088 19.9956 18.2657 19.9991 17.1351H13.1034V20.1417C13.1034 20.4397 13.1034 20.5886 12.9988 20.6488C12.8941 20.709 12.751 20.6424 12.4647 20.5092L11.0939 19.8713C10.9971 19.8262 10.9486 19.8037 10.8966 19.8037C10.8445 19.8037 10.796 19.8262 10.6992 19.8713L9.32842 20.5092C9.04213 20.6424 8.89899 20.709 8.79432 20.6488C8.68965 20.5886 8.68965 20.4397 8.68965 20.1417V17.1351Z" fill="#6aacc0"></path></g></svg>
									</div>

									<?php
								}
								?>
							
								<?php do_settings_fields( 'b2bking', 'b2bking_registration_settings_section' ); ?>
							</table>

							<h3 class="ui top attached block header">
								<i class="wrench icon"></i>
								<?php esc_html_e('Advanced Registration Settings','b2bking'); ?>
							</h3>
							<table class="form-table ui attached segment b2bking_settings_segment">
								<?php do_settings_fields( 'b2bking', 'b2bking_registration_settings_section_advanced' ); ?>
							</table>

						</div>
					</div>

					<!-- Bulk Order Form Tab--> 
					<div class="ui bottom attached tab segment bulkorder b2bking_bulkordersettings_tab <?php echo $this->b2bking_isactivetab('bulkorderform'); ?>" data-tab="bulkorderform">
						<div class="b2bking_attached_content_wrapper">
							<h2 class="ui block header">
								<i class="th list icon" style="font-size: 1.35em;"></i>
								<div class="content">
									<?php esc_html_e('Bulk Order Form','b2bking'); ?>
								</div>
							</h2>
							<?php

							if (!defined('B2BKINGLABEL_DIR')){
								?>
								<div class="ui ignored info icon message">
							      <div class="content">
							        <h3 class="header">	<?php esc_html_e('Documentation','b2bking'); ?></h3>
							        <p>
							            <?php
							            $order_form_link = '<a href="https://woocommerce-b2b-plugin.com/docs/wholesale-bulk-order-form/#2-toc-title" target="_blank" style="color: #295b6b"><span>&nbsp;<i class="code icon"></i><strong style="text-decoration: underline;">%s</strong></span></a>';
							            
							            $themes_styles_link = '<a href="https://woocommerce-b2b-plugin.com/docs/order-form-themes-styling/" target="_blank" style="color: #295b6b"><span style="color: #295b6b">&nbsp;&nbsp;<i class="paint brush icon"></i><strong style="text-decoration: underline;">%s</strong></span></a>';

							            $translated_text = sprintf(
							                /* translators: %1$s: Linked text for 'order form / shortcode', %2$s: Linked text for 'themes & styles' */
							                esc_html__('Learn more about the %1$s, and the available %2$s.', 'b2bking'),
							                sprintf($order_form_link, esc_html__('order form / shortcode', 'b2bking')),
							                sprintf($themes_styles_link, esc_html__('themes & styles', 'b2bking'))
							            );

							            echo wp_kses($translated_text, array(
							                'a' => array(
							                    'href' => array(),
							                    'target' => array(),
							                    'style' => array()
							                ),
							                'span' => array(
							                    'style' => array()
							                ),
							                'strong' => array(
							                    'style' => array()
							                ),
							                'i' => array(
							                    'class' => array()
							                )
							            ));
							            ?>
							        </p>
							      </div>
							      <svg viewBox="0 0 24 24" fill="#333" xmlns="http://www.w3.org/2000/svg" style="width: 50px;opacity:0.8"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M6.27103 2.11151C5.46135 2.21816 5.03258 2.41324 4.72718 2.71244C4.42179 3.01165 4.22268 3.43172 4.11382 4.225C4.00176 5.04159 4 6.12387 4 7.67568V16.2442C4.38867 15.9781 4.82674 15.7756 5.29899 15.6517C5.82716 15.513 6.44305 15.5132 7.34563 15.5135L20 15.5135V7.67568C20 6.12387 19.9982 5.04159 19.8862 4.22499C19.7773 3.43172 19.5782 3.01165 19.2728 2.71244C18.9674 2.41324 18.5387 2.21816 17.729 2.11151C16.8955 2.00172 15.7908 2 14.2069 2H9.7931C8.2092 2 7.10452 2.00172 6.27103 2.11151ZM6.75862 6.59459C6.75862 6.1468 7.12914 5.78378 7.58621 5.78378H16.4138C16.8709 5.78378 17.2414 6.1468 17.2414 6.59459C17.2414 7.04239 16.8709 7.40541 16.4138 7.40541H7.58621C7.12914 7.40541 6.75862 7.04239 6.75862 6.59459ZM7.58621 9.56757C7.12914 9.56757 6.75862 9.93058 6.75862 10.3784C6.75862 10.8262 7.12914 11.1892 7.58621 11.1892H13.1034C13.5605 11.1892 13.931 10.8262 13.931 10.3784C13.931 9.93058 13.5605 9.56757 13.1034 9.56757H7.58621Z" fill="#0e566c"></path> <path d="M8.68965 17.1351H7.47341C6.39395 17.1351 6.01657 17.1421 5.72738 17.218C4.93365 17.4264 4.30088 18.0044 4.02952 18.7558C4.0463 19.1382 4.07259 19.4746 4.11382 19.775C4.22268 20.5683 4.42179 20.9884 4.72718 21.2876C5.03258 21.5868 5.46135 21.7818 6.27103 21.8885C7.10452 21.9983 8.2092 22 9.7931 22H14.2069C15.7908 22 16.8955 21.9983 17.729 21.8885C18.5387 21.7818 18.9674 21.5868 19.2728 21.2876C19.5782 20.9884 19.7773 20.5683 19.8862 19.775C19.9776 19.1088 19.9956 18.2657 19.9991 17.1351H13.1034V20.1417C13.1034 20.4397 13.1034 20.5886 12.9988 20.6488C12.8941 20.709 12.751 20.6424 12.4647 20.5092L11.0939 19.8713C10.9971 19.8262 10.9486 19.8037 10.8966 19.8037C10.8445 19.8037 10.796 19.8262 10.6992 19.8713L9.32842 20.5092C9.04213 20.6424 8.89899 20.709 8.79432 20.6488C8.68965 20.5886 8.68965 20.4397 8.68965 20.1417V17.1351Z" fill="#0e566c"></path></g></svg>
								</div>
								<?php
							}
							?>
							<h3 class="ui top attached block header"><i class=" icon"><svg fill="#333" height="32px" width="32px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve" stroke="#333" stroke-width="9.216" style="
							    position: relative;
							    bottom: 6px;
							"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <g> <path d="M475.691,0.021c-14.656,0-27.776,8.725-33.451,22.251l-32.64,77.973c-9.728-9.152-22.421-14.933-36.267-14.933h-320 C23.936,85.312,0,109.248,0,138.645v320c0,29.397,23.936,53.333,53.333,53.333h320c29.397,0,53.333-23.936,53.333-53.333V225.152 l81.92-172.821c2.24-4.757,3.413-10.048,3.413-16.043C512,16.299,495.701,0.021,475.691,0.021z M405.333,458.645 c0,17.643-14.357,32-32,32h-320c-17.643,0-32-14.357-32-32v-320c0-17.643,14.357-32,32-32h320 c11.243,0,21.312,6.101,27.072,15.573l-37.739,90.197v-52.437c0-5.888-4.779-10.667-10.667-10.667H74.667 c-5.888,0-10.667,4.779-10.667,10.667v85.333c0,5.888,4.779,10.667,10.667,10.667h269.76l-8.939,21.333h-90.155 c-5.888,0-10.667,4.779-10.667,10.667v128c0,0.277,0.128,0.512,0.149,0.789c-8.768,7.787-14.144,10.389-14.528,10.539 c-3.371,1.259-5.888,4.096-6.699,7.616c-0.811,3.584,0.256,7.339,2.859,9.941c15.445,15.445,36.757,21.333,57.6,21.333 c26.645,0,52.48-9.643,64.128-21.333c16.768-16.768,29.056-50.005,19.776-74.773l47.381-99.925V458.645z M270.635,397.525 c2.944-9.685,5.739-18.859,14.229-27.349c15.083-15.083,33.835-15.083,48.917,0c13.504,13.504,3.2,45.717-10.667,59.584 c-11.563,11.541-52.672,22.677-80.256,8.256c3.669-2.859,7.893-6.549,12.672-11.328 C264.448,417.749,267.605,407.467,270.635,397.525z M256,375.339v-76.672h70.571l-16.363,39.083 c-14.251-0.256-28.565,5.483-40.448,17.387C263.125,361.771,259.008,368.661,256,375.339z M331.264,342.741l28.715-68.629 l16.128,7.915l-32.555,68.651C339.605,347.477,335.531,344.747,331.264,342.741z M341.333,170.645v64h-256v-64H341.333z M489.28,43.243l-104.064,219.52l-17.003-8.341l54.08-129.237l39.616-94.677c2.325-5.568,7.744-9.152,13.803-9.152 c8.235,0,14.933,6.699,14.933,15.659C490.645,39.147,490.176,41.344,489.28,43.243z"></path> </g> </g> <g> <g> <path d="M181.333,277.312H74.667c-5.888,0-10.667,4.779-10.667,10.667v149.333c0,5.888,4.779,10.667,10.667,10.667h106.667 c5.888,0,10.667-4.779,10.667-10.667V287.979C192,282.091,187.221,277.312,181.333,277.312z M170.667,426.645H85.333v-128h85.333 V426.645z"></path> </g> </g> </g></svg></i><?php esc_html_e('Theme & Design','b2bking');?></h3>
							<table class="form-table b2bking_bulkorder_section_settings ui  b2bking_settings_segment">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_bulkorderform_section_theme' ); ?>
							</table>
							<h3 class="ui top attached block header"><i class="search icon"></i><?php esc_html_e('Search Settings','b2bking');?></h3>
							<table class="form-table b2bking_bulkorder_section_settings ui b2bking_settings_segment">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_bulkorderform_section_search' ); ?>
							</table>

						</div>
					</div>

					<!-- Tiered Pricing Tab--> 
					<div class="ui bottom attached tab segment tieredpricing <?php echo $this->b2bking_isactivetab('tieredpricing'); ?>" data-tab="tieredpricing">
						<div class="b2bking_attached_content_wrapper">
							<h2 class="ui block header" style="position:relative;">
								<a class="ui teal right ribbon label view_documentation_ribbon" target="_blank" href="https://woocommerce-b2b-plugin.com/docs/b2bking-tiered-pricing-setup-auto-generated-tiered-pricing-table/"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 15px;position: absolute;left: 12px;top: 5px;"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M6.27103 2.11151C5.46135 2.21816 5.03258 2.41324 4.72718 2.71244C4.42179 3.01165 4.22268 3.43172 4.11382 4.225C4.00176 5.04159 4 6.12387 4 7.67568V16.2442C4.38867 15.9781 4.82674 15.7756 5.29899 15.6517C5.82716 15.513 6.44305 15.5132 7.34563 15.5135L20 15.5135V7.67568C20 6.12387 19.9982 5.04159 19.8862 4.22499C19.7773 3.43172 19.5782 3.01165 19.2728 2.71244C18.9674 2.41324 18.5387 2.21816 17.729 2.11151C16.8955 2.00172 15.7908 2 14.2069 2H9.7931C8.2092 2 7.10452 2.00172 6.27103 2.11151ZM6.75862 6.59459C6.75862 6.1468 7.12914 5.78378 7.58621 5.78378H16.4138C16.8709 5.78378 17.2414 6.1468 17.2414 6.59459C17.2414 7.04239 16.8709 7.40541 16.4138 7.40541H7.58621C7.12914 7.40541 6.75862 7.04239 6.75862 6.59459ZM7.58621 9.56757C7.12914 9.56757 6.75862 9.93058 6.75862 10.3784C6.75862 10.8262 7.12914 11.1892 7.58621 11.1892H13.1034C13.5605 11.1892 13.931 10.8262 13.931 10.3784C13.931 9.93058 13.5605 9.56757 13.1034 9.56757H7.58621Z" fill="#fff"></path> <path d="M8.68965 17.1351H7.47341C6.39395 17.1351 6.01657 17.1421 5.72738 17.218C4.93365 17.4264 4.30088 18.0044 4.02952 18.7558C4.0463 19.1382 4.07259 19.4746 4.11382 19.775C4.22268 20.5683 4.42179 20.9884 4.72718 21.2876C5.03258 21.5868 5.46135 21.7818 6.27103 21.8885C7.10452 21.9983 8.2092 22 9.7931 22H14.2069C15.7908 22 16.8955 21.9983 17.729 21.8885C18.5387 21.7818 18.9674 21.5868 19.2728 21.2876C19.5782 20.9884 19.7773 20.5683 19.8862 19.775C19.9776 19.1088 19.9956 18.2657 19.9991 17.1351H13.1034V20.1417C13.1034 20.4397 13.1034 20.5886 12.9988 20.6488C12.8941 20.709 12.751 20.6424 12.4647 20.5092L11.0939 19.8713C10.9971 19.8262 10.9486 19.8037 10.8966 19.8037C10.8445 19.8037 10.796 19.8262 10.6992 19.8713L9.32842 20.5092C9.04213 20.6424 8.89899 20.709 8.79432 20.6488C8.68965 20.5886 8.68965 20.4397 8.68965 20.1417V17.1351Z" fill="#fff"></path> </g></svg><?php esc_html_e('View Documentation','b2bking');?></a>
								<i class="icon" style="position:relative;font-size: 1.35em;padding-top: 0;top: 3px;"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#333"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M6.87988 18.1501V16.0801" stroke="#333" stroke-width="2" stroke-linecap="round"></path> <path d="M12 18.15V14.01" stroke="#333" stroke-width="2" stroke-linecap="round"></path> <path d="M17.1201 18.1499V11.9299" stroke="#333" stroke-width="2" stroke-linecap="round"></path> <path d="M17.1199 5.8501L16.6599 6.3901C14.1099 9.3701 10.6899 11.4801 6.87988 12.4301" stroke="#333" stroke-width="2" stroke-linecap="round"></path> <path d="M14.1899 5.8501H17.1199V8.7701" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z" stroke="#333" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg></i>
								<div class="content">
									<?php esc_html_e('Tiered Pricing & Table','b2bking'); ?>
								</div>
							</h2>
							<table class="form-table">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_tieredpricing_section' ); ?>
							</table>
							<h3 class="ui top attached block header"><i class="frontend table icon"></i><?php esc_html_e('Tiered Table','b2bking');?></h3>
							<table class="form-table ui attached segment b2bking_settings_segment">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_tieredpricing_section_table' ); ?>
							</table>
						</div>
					</div>

					<!-- Quotes & Offers Tab--> 
					<div class="ui bottom attached tab segment quotesoffers <?php echo $this->b2bking_isactivetab('quotesoffers'); ?>" data-tab="quotesoffers">
						<div class="b2bking_attached_content_wrapper">
							<h2 class="ui block header" style="position:relative;">
								<i class="icon" style="position:relative;font-size: 1.35em;padding-top: 0;top: 3px;">
									<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M21 7V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V7C3 4 4.5 2 8 2H16C19.5 2 21 4 21 7Z" stroke="#333" stroke-width="1.4" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M15.5 2V9.85999C15.5 10.3 14.98 10.52 14.66 10.23L12.34 8.09003C12.15 7.91003 11.85 7.91003 11.66 8.09003L9.34003 10.23C9.02003 10.52 8.5 10.3 8.5 9.85999V2H15.5Z" stroke="#333" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M13.25 14H17.5" stroke="#333" stroke-width="2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M9 18H17.5" stroke="#333" stroke-width="2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
								</i>
								<div class="content">
									<?php esc_html_e('Quotes & Offers','b2bking'); ?>
								</div>
							</h2>
							
							<h3 class="ui block header">
								<i class="clipboard list icon"></i>
								<?php esc_html_e('Quote Requests','b2bking'); ?>
							</h3>
							<?php
							if (!defined('B2BKINGLABEL_DIR')){
								?>
								<div class="ui ignored info icon message" style="margin-bottom: 25px;">
							      <div class="content">
							        <h3 class="header">	<?php esc_html_e('Documentation','b2bking'); ?></h3>
							        <p>
							            <?php
							            $custom_quote_button_link = '<a href="https://woocommerce-b2b-plugin.com/docs/request-a-custom-quote-button-in-cart-explained/" target="_blank" style="color: #295b6b"><span>&nbsp;<i class="hand point right icon"></i><strong style="text-decoration: underline;">%s</strong></span></a>';
							            
							            $quote_request_options_link = '<a href="https://woocommerce-b2b-plugin.com/docs/registered-user-access-restriction-replace-prices-with-request-a-quote/" target="_blank" style="color: #295b6b"><span style="color: #295b6b">&nbsp;<i class="file alternate icon"></i><strong style="text-decoration: underline;">%s</strong></span></a>';

							            $translated_text = sprintf(
							                /* translators: %1$s: Linked text for 'Request a Custom Quote button', %2$s: Linked text for 'quote request options in B2BKing' */
							                esc_html__('Learn about the %1$s, or read more about %2$s.', 'b2bking'),
							                sprintf($custom_quote_button_link, esc_html__('"Request a Custom Quote button"', 'b2bking')),
							                sprintf($quote_request_options_link, esc_html__('quote request options in B2BKing', 'b2bking'))
							            );

							            echo wp_kses($translated_text, array(
							                'a' => array(
							                    'href' => array(),
							                    'target' => array(),
							                    'style' => array()
							                ),
							                'span' => array(
							                    'style' => array()
							                ),
							                'strong' => array(
							                    'style' => array()
							                ),
							                'i' => array(
							                    'class' => array()
							                )
							            ));
							            ?>
							        </p>
							      </div>
							      <svg viewBox="0 0 24 24" fill="#333" xmlns="http://www.w3.org/2000/svg" style="width: 50px;opacity:0.65"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M6.27103 2.11151C5.46135 2.21816 5.03258 2.41324 4.72718 2.71244C4.42179 3.01165 4.22268 3.43172 4.11382 4.225C4.00176 5.04159 4 6.12387 4 7.67568V16.2442C4.38867 15.9781 4.82674 15.7756 5.29899 15.6517C5.82716 15.513 6.44305 15.5132 7.34563 15.5135L20 15.5135V7.67568C20 6.12387 19.9982 5.04159 19.8862 4.22499C19.7773 3.43172 19.5782 3.01165 19.2728 2.71244C18.9674 2.41324 18.5387 2.21816 17.729 2.11151C16.8955 2.00172 15.7908 2 14.2069 2H9.7931C8.2092 2 7.10452 2.00172 6.27103 2.11151ZM6.75862 6.59459C6.75862 6.1468 7.12914 5.78378 7.58621 5.78378H16.4138C16.8709 5.78378 17.2414 6.1468 17.2414 6.59459C17.2414 7.04239 16.8709 7.40541 16.4138 7.40541H7.58621C7.12914 7.40541 6.75862 7.04239 6.75862 6.59459ZM7.58621 9.56757C7.12914 9.56757 6.75862 9.93058 6.75862 10.3784C6.75862 10.8262 7.12914 11.1892 7.58621 11.1892H13.1034C13.5605 11.1892 13.931 10.8262 13.931 10.3784C13.931 9.93058 13.5605 9.56757 13.1034 9.56757H7.58621Z" fill="#0e566c"></path> <path d="M8.68965 17.1351H7.47341C6.39395 17.1351 6.01657 17.1421 5.72738 17.218C4.93365 17.4264 4.30088 18.0044 4.02952 18.7558C4.0463 19.1382 4.07259 19.4746 4.11382 19.775C4.22268 20.5683 4.42179 20.9884 4.72718 21.2876C5.03258 21.5868 5.46135 21.7818 6.27103 21.8885C7.10452 21.9983 8.2092 22 9.7931 22H14.2069C15.7908 22 16.8955 21.9983 17.729 21.8885C18.5387 21.7818 18.9674 21.5868 19.2728 21.2876C19.5782 20.9884 19.7773 20.5683 19.8862 19.775C19.9776 19.1088 19.9956 18.2657 19.9991 17.1351H13.1034V20.1417C13.1034 20.4397 13.1034 20.5886 12.9988 20.6488C12.8941 20.709 12.751 20.6424 12.4647 20.5092L11.0939 19.8713C10.9971 19.8262 10.9486 19.8037 10.8966 19.8037C10.8445 19.8037 10.796 19.8262 10.6992 19.8713L9.32842 20.5092C9.04213 20.6424 8.89899 20.709 8.79432 20.6488C8.68965 20.5886 8.68965 20.4397 8.68965 20.1417V17.1351Z" fill="#0e566c"></path></g></svg>
								</div>
								<?php
							}
							?>
							<div class="ui form b2bking_plugin_status_container b2bking_quote_cart_container">
							  <div class="inline fields">
							  	<?php

							  	$tip = esc_html__('A "request custom quote" button is shown on the cart page, allowing customers to either purchase outright, or request a special quote. If you need to disable purchases and allow quotes only, click for documentation.','b2bking').'<br><img class="b2bking_tooltip_img" src="https://kingsplugins.com/wp-content/uploads/2024/08/quote-cart-button-explainer.webp">';
							  	?>

							    <label style="width:400px;font-size:14px;margin-right:25px;"><?php echo esc_html__('"Request a Custom Quote" button in cart','b2bking').'&nbsp;<a target="_blank" href="https://woocommerce-b2b-plugin.com/docs/new-dynamic-rule-replace-cart-with-quote-system/">'.wc_help_tip($tip, false).'</a>';?></label>
							    <div class="field">
							      <div class="ui checkbox">
							        <input type="radio" tabindex="0" class="hidden" name="b2bking_quote_button_cart_setting" value="disabled" <?php checked('disabled',get_option( 'b2bking_quote_button_cart_setting', 'enableb2b' ), true); ?>">
							        <label><?php esc_html_e('Disabled','b2bking'); ?></label>
							      </div>
							    </div>
							    <div class="field">
							      <div class="ui checkbox">
							        <input type="radio" tabindex="0" class="hidden" name="b2bking_quote_button_cart_setting" value="enableb2b" <?php checked('enableb2b',get_option( 'b2bking_quote_button_cart_setting', 'enableb2b' ), true); ?>">
							        <label><?php esc_html_e('Enabled for B2B','b2bking'); ?></label>
							      </div>
							    </div>
							    <div class="field">
							      <div class="ui checkbox">
							        <input type="radio" tabindex="0" class="hidden" name="b2bking_quote_button_cart_setting" value="enableb2c" <?php checked('enableb2c',get_option( 'b2bking_quote_button_cart_setting', 'enableb2b' ), true); ?>">
							        <label><?php esc_html_e('Enabled for Guests + B2C','b2bking'); ?></label>
							      </div>
							    </div>
							    <div class="field">
							      <div class="ui checkbox">
							        <input type="radio" tabindex="0" class="hidden" name="b2bking_quote_button_cart_setting" value="enableall" <?php checked('enableall',get_option( 'b2bking_quote_button_cart_setting', 'enableb2b' ), true); ?>">
							        <label><?php esc_html_e('Enabled for ALL','b2bking'); ?></label>
							      </div>
							    </div>
							    
							  </div>
							  
							</div>
							<table class="form-table b2bking_quotes_section">
								<?php do_settings_fields( 'b2bking', 'b2bking_quotes_settings_section' ); ?>
							</table>

							<!-- BUTTON QUOTE FIELDS -->

							<table class="form-table b2bking_quotes_section">
								<tbody>
									<tr><th scope="row"><?php esc_html_e('Manage quote request form fields','b2bking'); ?><p class="b2bking_setting_description"><?php esc_html_e('Customize, add, or edit the fields in the quote request form','b2bking'); ?></p></th>
										<td>
											<a href="<?php echo esc_attr(admin_url('/edit.php?post_type=b2bking_quote_field'));?>" target="_blank">
												<button type="button" name="b2bking-quote-fields" id="b2bking-quote-fields" class="ui teal button">
													<i class="pencil icon"></i>
													<?php esc_html_e('Manage Form Fields', 'b2bking'); ?>
												</button>
											</a>
										</td>
									</tr>							
								</tbody>
							</table>

							<h3 class="ui block header">
								<i class="box icon"></i>
								<?php esc_html_e('Offers','b2bking'); ?>
							</h3>
							<table class="form-table">
								
								<?php
								if (!defined('B2BKINGLABEL_DIR')){
									?>
									<div class="ui ignored info icon message">
								      <div class="content">
								        <h3 class="header">	<?php esc_html_e('Documentation','b2bking'); ?></h3>
								        <p>
						                   <?php
						                   $learn_more_link = '<a href="https://woocommerce-b2b-plugin.com/docs/offers-2/" target="_blank" style="color: #295b6b"><strong style="text-decoration: underline;">%s</strong></a>';
						                   $translated_text = sprintf(
						                       /* translators: %s: Linked text for 'offers functionality' */
						                       esc_html__('Learn about %s in B2BKing.', 'b2bking'),
						                       sprintf($learn_more_link, esc_html__('offers functionality', 'b2bking'))
						                   );
						                   echo wp_kses($translated_text, array(
						                       'a' => array(
						                           'href' => array(),
						                           'target' => array(),
						                           'style' => array()
						                       ),
						                       'strong' => array(
						                           'style' => array()
						                       )
						                   ));
						                   ?>
						               </p>							      </div>
								      <svg viewBox="0 0 24 24" fill="#333" xmlns="http://www.w3.org/2000/svg" style="width: 50px;opacity:0.65"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M6.27103 2.11151C5.46135 2.21816 5.03258 2.41324 4.72718 2.71244C4.42179 3.01165 4.22268 3.43172 4.11382 4.225C4.00176 5.04159 4 6.12387 4 7.67568V16.2442C4.38867 15.9781 4.82674 15.7756 5.29899 15.6517C5.82716 15.513 6.44305 15.5132 7.34563 15.5135L20 15.5135V7.67568C20 6.12387 19.9982 5.04159 19.8862 4.22499C19.7773 3.43172 19.5782 3.01165 19.2728 2.71244C18.9674 2.41324 18.5387 2.21816 17.729 2.11151C16.8955 2.00172 15.7908 2 14.2069 2H9.7931C8.2092 2 7.10452 2.00172 6.27103 2.11151ZM6.75862 6.59459C6.75862 6.1468 7.12914 5.78378 7.58621 5.78378H16.4138C16.8709 5.78378 17.2414 6.1468 17.2414 6.59459C17.2414 7.04239 16.8709 7.40541 16.4138 7.40541H7.58621C7.12914 7.40541 6.75862 7.04239 6.75862 6.59459ZM7.58621 9.56757C7.12914 9.56757 6.75862 9.93058 6.75862 10.3784C6.75862 10.8262 7.12914 11.1892 7.58621 11.1892H13.1034C13.5605 11.1892 13.931 10.8262 13.931 10.3784C13.931 9.93058 13.5605 9.56757 13.1034 9.56757H7.58621Z" fill="#0e566c"></path> <path d="M8.68965 17.1351H7.47341C6.39395 17.1351 6.01657 17.1421 5.72738 17.218C4.93365 17.4264 4.30088 18.0044 4.02952 18.7558C4.0463 19.1382 4.07259 19.4746 4.11382 19.775C4.22268 20.5683 4.42179 20.9884 4.72718 21.2876C5.03258 21.5868 5.46135 21.7818 6.27103 21.8885C7.10452 21.9983 8.2092 22 9.7931 22H14.2069C15.7908 22 16.8955 21.9983 17.729 21.8885C18.5387 21.7818 18.9674 21.5868 19.2728 21.2876C19.5782 20.9884 19.7773 20.5683 19.8862 19.775C19.9776 19.1088 19.9956 18.2657 19.9991 17.1351H13.1034V20.1417C13.1034 20.4397 13.1034 20.5886 12.9988 20.6488C12.8941 20.709 12.751 20.6424 12.4647 20.5092L11.0939 19.8713C10.9971 19.8262 10.9486 19.8037 10.8966 19.8037C10.8445 19.8037 10.796 19.8262 10.6992 19.8713L9.32842 20.5092C9.04213 20.6424 8.89899 20.709 8.79432 20.6488C8.68965 20.5886 8.68965 20.4397 8.68965 20.1417V17.1351Z" fill="#0e566c"></path></g></svg>
									</div>
									<?php
								}
								?>
								<?php do_settings_fields( 'b2bking', 'b2bking_offers_settings_section' ); ?>
							</table>

						</div>
					</div>

					<!-- Language Tab--> 
					<div class="ui bottom attached tab segment b2bking_languagesettings_tab <?php echo $this->b2bking_isactivetab('language'); ?>" data-tab="language">
						<div class="b2bking_attached_content_wrapper">
							<h2 class="ui block header">
								<i class="language icon"></i>
								<div class="content">
									<?php esc_html_e('Language and Text','b2bking'); ?>
								</div>

							</h2>
							<?php 
							if (!defined('B2BKINGLABEL_DIR')){
								?>
								<div class="ui ignored info icon message">
							      <div class="content">
							        <h3 class="header">	<?php esc_html_e('Documentation','b2bking'); ?></h3>
							        <p>
							            <?php
							            $translate_link = '<a href="https://woocommerce-b2b-plugin.com/docs/wholesale-bulk-order-form/#2-toc-title" target="_blank" style="color: #295b6b"><span>&nbsp;<i class="language icon"></i>&nbsp;<strong style="text-decoration: underline;">%s</strong></span></a>';
							            $customize_link = '<a href="https://woocommerce-b2b-plugin.com/docs/how-to-edit-any-plugin-text-string-same-language/" target="_blank" style="color: #295b6b"><span><i class="file alternate outline icon"></i><strong style="text-decoration: underline;">%s</strong></span></a>';

							            $translated_text = sprintf(
							                /* translators: %1$s: Linked text for 'how to translate B2BKing', %2$s: Linked text for 'how to customize any text' */
							                esc_html__('Learn %1$s to any language (localization), or %2$s in the plugin.', 'b2bking'),
							                sprintf($translate_link, esc_html__('how to translate B2BKing', 'b2bking')),
							                sprintf($customize_link, esc_html__('how to customize any text', 'b2bking'))
							            );

							            echo wp_kses($translated_text, array(
							                'a' => array(
							                    'href' => array(),
							                    'target' => array(),
							                    'style' => array()
							                ),
							                'span' => array(),
							                'i' => array(
							                    'class' => array()
							                ),
							                'strong' => array(
							                    'style' => array()
							                )
							            ));
							            ?>
							        </p>
							      </div>
							      <svg viewBox="0 0 24 24" fill="#333" xmlns="http://www.w3.org/2000/svg" style="width: 50px;opacity:0.88"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M6.27103 2.11151C5.46135 2.21816 5.03258 2.41324 4.72718 2.71244C4.42179 3.01165 4.22268 3.43172 4.11382 4.225C4.00176 5.04159 4 6.12387 4 7.67568V16.2442C4.38867 15.9781 4.82674 15.7756 5.29899 15.6517C5.82716 15.513 6.44305 15.5132 7.34563 15.5135L20 15.5135V7.67568C20 6.12387 19.9982 5.04159 19.8862 4.22499C19.7773 3.43172 19.5782 3.01165 19.2728 2.71244C18.9674 2.41324 18.5387 2.21816 17.729 2.11151C16.8955 2.00172 15.7908 2 14.2069 2H9.7931C8.2092 2 7.10452 2.00172 6.27103 2.11151ZM6.75862 6.59459C6.75862 6.1468 7.12914 5.78378 7.58621 5.78378H16.4138C16.8709 5.78378 17.2414 6.1468 17.2414 6.59459C17.2414 7.04239 16.8709 7.40541 16.4138 7.40541H7.58621C7.12914 7.40541 6.75862 7.04239 6.75862 6.59459ZM7.58621 9.56757C7.12914 9.56757 6.75862 9.93058 6.75862 10.3784C6.75862 10.8262 7.12914 11.1892 7.58621 11.1892H13.1034C13.5605 11.1892 13.931 10.8262 13.931 10.3784C13.931 9.93058 13.5605 9.56757 13.1034 9.56757H7.58621Z" fill="#0e566c"></path> <path d="M8.68965 17.1351H7.47341C6.39395 17.1351 6.01657 17.1421 5.72738 17.218C4.93365 17.4264 4.30088 18.0044 4.02952 18.7558C4.0463 19.1382 4.07259 19.4746 4.11382 19.775C4.22268 20.5683 4.42179 20.9884 4.72718 21.2876C5.03258 21.5868 5.46135 21.7818 6.27103 21.8885C7.10452 21.9983 8.2092 22 9.7931 22H14.2069C15.7908 22 16.8955 21.9983 17.729 21.8885C18.5387 21.7818 18.9674 21.5868 19.2728 21.2876C19.5782 20.9884 19.7773 20.5683 19.8862 19.775C19.9776 19.1088 19.9956 18.2657 19.9991 17.1351H13.1034V20.1417C13.1034 20.4397 13.1034 20.5886 12.9988 20.6488C12.8941 20.709 12.751 20.6424 12.4647 20.5092L11.0939 19.8713C10.9971 19.8262 10.9486 19.8037 10.8966 19.8037C10.8445 19.8037 10.796 19.8262 10.6992 19.8713L9.32842 20.5092C9.04213 20.6424 8.89899 20.709 8.79432 20.6488C8.68965 20.5886 8.68965 20.4397 8.68965 20.1417V17.1351Z" fill="#0e566c"></path></g></svg>
								</div>
								<?php
							}
							?>
							<h3 class="ui block header">
								<i class="paragraph icon"></i>
								<?php esc_html_e('Scripts Language','b2bking'); ?>
							</h3>
							<table class="form-table">
								<?php do_settings_fields( 'b2bking', 'b2bking_languagesettings_purchaselists_section' ); ?>
							</table>
							<h3 class="ui block header b2bking_text_settings_container_lang">
								<div>
									<i class="edit outline icon" style="font-size: 1.2em;"></i>
									<?php esc_html_e('Text Settings','b2bking'); ?>
								</div>
								<a href="https://woocommerce-b2b-plugin.com/docs/how-to-add-a-link-to-login-to-view-prices/#2-toc-title" target="_blank"><div class="b2bking_icons_container">
									<?php
									esc_html_e('Add icons to text','b2bking');
										// show icons
										$icons = b2bking()->get_icons();
										foreach ($icons as $icon_name => $svg){
											if (!empty($svg)){
												echo $svg;
											}
										}
									?>
								</div></a>
							</h3>
							<table class="form-table">
								<?php do_settings_fields( 'b2bking', 'b2bking_languagesettings_text_section' ); ?>
							</table>
								
							
						</div>
					</div>

					<!-- License Tab--> 
					<div class="ui bottom attached tab segment <?php echo $this->b2bking_isactivetab('license'); ?>" data-tab="license">
						<div class="b2bking_attached_content_wrapper">
							<h2 class="ui block header">
								<i class="key icon"></i>
								<div class="content">
									<?php esc_html_e('License management','b2bking'); ?>
									<div class="sub header">
										<?php esc_html_e('Activate the plugin to get automatic updates','b2bking'); ?>
									</div>
								</div>
							</h2>
							<table class="form-table">
								<?php do_settings_fields( 'b2bking', 'b2bking_license_settings_section' ); ?>
							</table>
							<!-- License Status -->
							<?php
							$license = get_option('b2bking_license_key_setting', '');
							$email = get_option('b2bking_license_email_setting', '');
							$info = parse_url(get_site_url());
							$host = $info['host'];
							$host_names = explode(".", $host);

							if (isset($host_names[count($host_names)-2])){
								$bottom_host_name = $host_names[count($host_names)-2] . "." . $host_names[count($host_names)-1];

								if (strlen($host_names[count($host_names)-2]) <= 3){    // likely .com.au, .co.uk, .org.uk etc
									if (isset($host_names[count($host_names)-3])){
									    $bottom_host_name_new = $host_names[count($host_names)-3] . "." . $host_names[count($host_names)-2] . "." . $host_names[count($host_names)-1];
									    $bottom_host_name = $bottom_host_name_new;
									}

								}

								
								$activation = get_option('pluginactivation_'.$email.'_'.$license.'_'.$bottom_host_name);

								if ($activation == 'active'){
									
									$license_email_display = $this->mask_email(get_option('b2bking_license_email_setting', ''));
									$license_key_display = $this->mask_license_key(get_option('b2bking_license_key_setting', ''));

									// show blurred license details
									?>
									<table class="form-table">
										<tbody><tr><th scope="row"><?php esc_html_e('License Email','b2bking');?></th><td>
											<div class="ui form">
												<div class="field">
													<input type="text" class="b2bking_license_field" value="<?php echo esc_attr($license_email_display);?>" disabled="disabled">
												</div>
											</div>
											</td></tr><tr><th scope="row"><?php esc_html_e('License Key','b2bking');?></th><td>
											<div class="ui form">
												<div class="field">
													<input type="text" class="b2bking_license_field" value="<?php echo esc_attr($license_key_display);?>" disabled="disabled">
												</div>
											</div>
											</td></tr>							
										</tbody>
									</table>

									<div class="ui success message b2bking_license_active">
									  <div class="header">
									    <?php esc_html_e('Your license is valid and active','b2bking'); ?>
									  </div>
									  <p><?php esc_html_e('The plugin is registered to ','b2bking'); echo esc_html($this->mask_email($email)); ?> </p>
									</div>
									<div id="b2bking_deactivate_license" class="mini ui grey basic button">
										<i class="cut icon"></i> 
										<?php esc_html_e('Deactivate license','b2bking');?>
									</div>
									<?php		
								} else {
									?>
									<button type="button" name="b2bking-activate-license" id="b2bking-activate-license" class="ui teal button">
										<i class="key icon"></i>
										<?php esc_html_e('Activate License', 'b2bking'); ?>
									</button>

									<br><br>
									<div class="ui warning message b2bking_license_active">
									  <div class="header">
									    <?php esc_html_e('Your license is not active. Activate now to receive vital plugin updates and features!','b2bking'); ?>
									  </div>
									  <p>These include critical security updates, compatibility with the latest WooCommerce versions, and much more.<p>
									  <p><?php echo esc_html__('Click to learn more about','b2bking').' <a target="_blank" href="https://kingsplugins.com/licensing-faq/">'.esc_html__('how to activate the plugin license','b2bking').'</a>'.' or '.'<a href="https://webwizards.ticksy.com/submit/#100016894" target="_blank">'.esc_html__('contact support','b2bking').'.</a>';;?></p>
									</div>
									<?php
									if (!empty($email) && isset($_GET['tab'])){
										if ($_GET['tab'] === 'activate'){											
											add_action('admin_footer', function(){
											  ?>
											  <script id="profitwell-js" data-pw-auth="f178eb0b265d7a7472355c0732569f8b">
											      (function(i,s,o,g,r,a,m){i[o]=i[o]||function(){(i[o].q=i[o].q||[]).push(arguments)};
											      a=s.createElement(g);m=s.getElementsByTagName(g)[0];a.async=1;a.src=r+'?auth='+
											      s.getElementById(o+'-js').getAttribute('data-pw-auth');m.parentNode.insertBefore(a,m);
											      })(window,document,'profitwell','script','https://public.profitwell.com/js/profitwell.js');
											      
											      profitwell('start', { 'user_email': '<?php 

											      $email = get_option('b2bking_license_email_setting', '');

											      echo $email; ?>' });
											  </script>
											  <?php
											});
										}
									}
								}
							} else {
								// local, no activation
								esc_html_e('The current site appears to be a local site without a domain name, therefore the license cannot be activated. Please activate after moving the site to your domain.','b2bking');
							}
							
							?>

							<br><br>

							<?php
							if (!defined('B2BKINGLABEL_DIR')){
								?>
								<div class="ui info message">
								  <div class="header"> <i class="question circle icon"></i>
								  	<?php esc_html_e('Information','b2bking'); ?>
								  </div>
								  <ul class="list">
								    <li><a href="https://kingsplugins.com/licensing-faq/" target="_blank"><?php esc_html_e('Licensing and Activation FAQ & Guide','b2bking'); ?></a></li>
								    <li><a href="https://kingsplugins.com/licensing-faq#headline-66-565" target="_blank"><?php esc_html_e('How to activate if you purchased on Envato Market','b2bking'); ?></a></li>
								    <li><a href="https://kingsplugins.com/woocommerce-wholesale/b2bking/pricing/" target="_blank"><?php esc_html_e('Purchase a new license','b2bking'); ?></a></li>

								  </ul>

								</div>
								<?php
							}
							?>
							
						</div>
					</div>


					<?php

						do_action('b2bking_settings_panel_end_items_tabs');

					?>

					<!-- Other settings tab--> 
					<div class="ui bottom attached tab segment b2bking_othersettings_tab <?php echo $this->b2bking_isactivetab('othersettings'); ?>" data-tab="othersettings">
						<div class="b2bking_attached_content_wrapper">
							<h2 class="ui block header">
								<i class="cog icon"></i>
								<div class="content">
									<?php esc_html_e('Other settings','b2bking'); ?>
									<div class="sub header">
										<?php esc_html_e('Miscellaneous settings','b2bking'); ?>
									</div>
								</div>
							</h2>
							<h3 class="ui top attached block header">
								<i class="paint brush icon"></i>
								<?php esc_html_e('Color & Design','b2bking'); ?>
							</h3>
							<table class="form-table">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_colordesign_section' ); ?>

								<!-- PURCHASE LISTS -->
								<tr>
									<th scope="row"><?php esc_html_e('Purchase Lists Header','b2bking');?></th>
									<td><input name="b2bking_purchase_lists_color_header_setting" type="color" value="<?php echo esc_attr( get_option( 'b2bking_purchase_lists_color_header_setting', '#353042' ) ); ?>"></td>
									<td class="b2bking_settings_row_td"><span class="b2bking_settings_row_label"><?php esc_html_e('Lists Action Buttons','b2bking');?></span><input name="b2bking_purchase_lists_color_action_buttons_setting" type="color" value="<?php echo esc_attr( get_option( 'b2bking_purchase_lists_color_action_buttons_setting', '#b1b1b1' ) ); ?>"></td>
									<td class="b2bking_settings_row_td"><span class="b2bking_settings_row_label"><?php esc_html_e('New List Button','b2bking');?></span><input name="b2bking_purchase_lists_color_new_list_setting" type="color" value="<?php echo esc_attr( get_option( 'b2bking_purchase_lists_color_new_list_setting', '#353042' ) ); ?>"></td>
								</tr>
							</table>
							
							<h3 class="ui top attached block header">
								<i class="laptop icon"></i>
								<?php esc_html_e('Price and Product Display','b2bking'); ?>
							</h3>
							<table class="form-table other_toggles other_toggles_multiple">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_priceproductdisplay_section' ); ?>
							</table>
							<h3 class="ui top attached block header">
								<i class="linkify icon"></i>
								<?php esc_html_e('Permalinks','b2bking'); ?>
							</h3>
							<table class="form-table other_toggles">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_permalinks_section' ); ?>
							</table>
							<h3 class="ui top attached block header">
								<i class="sitemap icon"></i>
								<?php esc_html_e('Multisite','b2bking'); ?>
							</h3>
							<table class="form-table other_toggles">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_multisite_section' ); ?>
							</table>
							<h3 class="ui top attached block header">
								<i class="shopping basket icon"></i>
								<?php esc_html_e('Large Stores','b2bking'); ?>
							</h3>
							<table class="form-table other_toggles other_toggles_multiple">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_largestores_section' ); ?>
							</table>
							<h3 class="ui top attached block header">
								<i class="sliders horizontal icon"></i>
								<?php esc_html_e('VAT Validation','b2bking'); ?>
							</h3>
							<table class="form-table other_toggles other_toggles_multiple">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_vat_section' ); ?>
							</table>
							<h3 class="ui top attached block header b2bking_advanced_visibility">
								<i class="rocket icon"></i>
								<?php esc_html_e('Advanced Visibility Settings','b2bking'); ?>
							</h3>
							<table class="form-table other_toggles other_toggles_multiple">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_caching_section' ); ?>
							</table>
							<table class="form-table other_toggles other_toggles_multiple">
								<?php do_settings_fields( 'b2bking', 'b2bking_access_restriction_category_settings_section' ); ?>
							</table>

							

							<h3 class="ui top attached block header">
								<i class="id badge icon"></i>
								<?php esc_html_e('Subaccounts & Company','b2bking'); ?>
							</h3>
							<table class="form-table other_toggles">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_company_section' ); ?>
							</table>

							<h3 class="ui top attached block header">
								<i class="object group icon"></i>
								<?php esc_html_e('Compatibility','b2bking'); ?>
							</h3>
							<table class="form-table other_toggles">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_compatibility_section' ); ?>
							</table>

							<h3 class="ui top attached block header">
								<i class="warehouse icon"></i>
								<?php esc_html_e('Stock','b2bking'); ?>
							</h3>
							<table class="form-table">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_stock_section' ); ?>
							</table>

							<h3 class="ui top attached block header">
								<i class="tag icon"></i>
								<?php esc_html_e('Coupons','b2bking'); ?>
							</h3>
							<table class="form-table">
								<?php do_settings_fields( 'b2bking', 'b2bking_othersettings_coupons_section' ); ?>
							</table>

							<!-- ACCORDIONS -->
							<h3 class="ui block header">
								<i class="cubes icon"></i>
								<?php esc_html_e('Advanced: Endpoints & Components','b2bking'); ?>
							</h3>
								<div class="ui styled accordion b2bking_accordion">

									<!-- ENDPOINTS -->
									<div class="title">
										<i class="dropdown icon"></i>
									  	<?php esc_html_e('Endpoints', 'b2bking'); ?>
									</div>
									<div class="content">
									  	<h2 class="ui block header">
									  		<i class="window maximize outline icon"></i>
									  		<?php esc_html_e('Endpoints','b2bking'); ?>
									  	</h2>
									  	<table class="form-table">
									  		
									  		<?php  do_settings_fields( 'b2bking', 'b2bking_othersettings_endpoints_section' ); ?>
									  			
									  	</table>
									</div>

									<!-- COMPONENTS -->
							        <div class="title">
							        	<i class="dropdown icon"></i>
							          	<?php esc_html_e('Components', 'b2bking'); ?>
							        </div>
							        <div class="content">
							          	<h2 class="ui block header">
							          		<i class="cubes icon"></i>
							          		<div class="content">
							          			<?php esc_html_e('Components Settings','b2bking'); ?>
							          			<div class="sub header">
							          				<?php esc_html_e('Disable individual plugin components','b2bking'); ?>
							          			</div>
							          		</div>
							          	</h2>
							          	<table class="form-table">
							          		<?php
							          		if (!defined('B2BKINGLABEL_DIR')){
								          			?>
								          		<div class="ui info message">
								          		  <i class="close icon"></i>
								          		  <div class="header">
								          		  	<?php esc_html_e('Functionality Explained','b2bking'); ?>
								          		  </div>
								          		  <ul class="list">
								          		    <?php esc_html_e('Disabling individual plugin components may help you troubleshoot issues, prevent plugin conflicts, or in edge cases improve performance. ','b2bking');?>
								          		  </ul>
								          		</div>
								          		<?php
								          	}
								          	?>
							          		<?php  do_settings_fields( 'b2bking', 'b2bking_performance_settings_section' ); ?>
							          			
							          	</table>
							        </div>
							    </div>

								



							
							
					
						</div>
					</div>
				</div>
			</div>

			<br>
			<input type="submit" name="submit" id="b2bking-admin-submit" class="ui primary button" value="Save Settings">

		</form>

		<?php
	}

	function b2bking_isactivetab($tab){
		$gototab = get_option( 'b2bking_current_tab_setting', 'accessrestriction' );
		if ($tab === $gototab){
			return 'active';
		} 
	}

	function mask_email($email) {
	    $email_parts = explode('@', $email);
	    $local_part = $email_parts[0];
	    $domain_part = $email_parts[1];
	    
	    // Handle local parts with length 1 or 2 differently
	    if (strlen($local_part) <= 2) {
	        $masked_local_part = str_repeat('*', strlen($local_part));
	    } else {
	        // Original masking for longer local parts
	        $masked_local_part = substr($local_part, 0, 1) . 
	                            str_repeat('*', strlen($local_part) - 2) . 
	                            substr($local_part, -1);
	    }
	    
	    return $masked_local_part . '@' . $domain_part;
	}

	// Function to mask part of the license key
	function mask_license_key($license_key) {
	    // Show first 4 and last 4 characters, mask the middle part
	    return substr($license_key, 0, 4) . str_repeat('*', strlen($license_key) - 8) . substr($license_key, -4);
	}

}