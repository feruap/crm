<?php
/*
/**
 * Plugin Name:       SalesKing
 * Plugin URI:        woocommerce-b2b-plugin.com
 * Description:       SalesKing is the ultimate sales team, sales reps & agents management solution for WooCommerce
 * Version:           1.8.15
 * Author:            WebWizards
 * Author URI:        webwizards.dev
 * Text Domain:       salesking
 * Domain Path:       /languages
 * WC requires at least: 5.0.0
 * WC tested up to: 10.4.3
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
	die;
}

define( 'SALESKING_DIR', plugin_dir_path( __FILE__ ) );

if ( ! defined( 'SALESKING_VERSION' ) ) {
    define( 'SALESKING_VERSION', 'v1.8.15');
}


// Autoupdates
require 'includes/assets/lib/plugin-update-checker/plugin-update-checker.php';
use YahnisElsts\PluginUpdateCheckerSK\v5\PucFactory;

// Autoupdates
$license = get_option('salesking_license_key_setting', '');
$email = get_option('salesking_license_email_setting', '');
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

    if ($activation == 'active'){
        $myUpdateChecker = PucFactory::buildUpdateChecker(
            'https://kingsplugins.com/wp-json/licensing/v1/request?email='.$email.'&license='.$license.'&requesttype=autoupdates&plugin=SK&website='.$bottom_host_name,
            __FILE__,
            'salesking'
        );
    }
}


function salesking_activate() {
	require_once SALESKING_DIR . 'includes/class-salesking-activator.php';
	Salesking_Activator::activate();

}
register_activation_hook( __FILE__, 'salesking_activate' );


require SALESKING_DIR . 'includes/class-salesking.php';

// Load plugin language
add_action( 'plugins_loaded', 'salesking_load_language');
function salesking_load_language() {
	load_plugin_textdomain( 'salesking', FALSE, basename( dirname( __FILE__ ) ) . '/languages');
}

// Begins execution of the plugin.
function salesking_run() {
    if (intval(get_option('salesking_disable')) === 0){
	   $plugin = new Salesking();
    }
}

salesking_run();

add_action( 'before_woocommerce_init', function() {
    if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
    }
} );
