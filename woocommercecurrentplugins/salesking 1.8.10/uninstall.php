<?php

/**
 * Fires when the plugin is uninstalled.
 */

// If uninstall not called from WordPress, then exit.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Check if Keep Data and Settings on Uninstall option is activated. If activated, do not erase data and settings
$keep_data_setting = boolval(get_option( 'salesking_keepdata_setting', 1 ));

// If "keep data" option is NOT activated
if (!$keep_data_setting) {

	// List all options
	$optionlist = array('salesking_all_products_visible_all_users_setting', 'salesking_enabletags_setting','salesking_keepdata_setting', 'salesking_enable_subaccounts_setting', 'salesking_enable_bulk_order_form_setting', 'salesking_enable_purchase_lists_setting', 'salesking_enable_offers_setting', 'salesking_enable_conversations_setting', 'salesking_approval_required_all_users_setting', 'salesking_registration_roles_dropdown_setting', 'salesking_guest_access_restriction_setting', 'salesking_current_tab_setting', 'salesking_plugin_status_setting', ); 

	// Delete all options
	foreach ($optionlist as $option_name){ 
		delete_option($option_name);
	} 
	  
}