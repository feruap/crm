<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_DESIGN {
	protected $settings;
	protected $prefix;
	protected $languages;
	protected $default_language;
	protected $languages_data;
	protected $capability;

	public function __construct() {
		$this->settings         = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
		$this->prefix           = 'vi-wot-orders-tracking-customize-';
		$this->languages        = array();
		$this->languages_data   = array();
		$this->default_language = '';
		$this->capability       = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'customize' );
		add_action( 'customize_register', array( $this, 'design_option_customizer' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'customize_controls_print_styles' ) );
		add_action( 'customize_preview_init', array( $this, 'customize_preview_init' ) );
		add_action( 'customize_controls_enqueue_scripts', array( $this, 'customize_controls_enqueue_scripts' ), 30 );
		add_action( 'wp_ajax_vi_wot_customize_params_date_time_format', array(
			$this,
			'vi_wot_customize_params_date_time_format'
		) );
	}

	public function vi_wot_customize_params_date_time_format() {
		if ( ! current_user_can( $this->capability ) ) {
			wp_die( esc_html__( 'You do not have permission.', 'woocommerce-orders-tracking' ) );
		}
		$format     = isset( $_POST['format'] ) ? sanitize_text_field( $_POST['format'] ) : '';
		$use_locale = isset( $_POST['use_locale'] ) ? sanitize_text_field( $_POST['use_locale'] ) : '';
		$results    = array();
		$response   = array(
			'status'  => 'error',
			'results' => $results
		);
		if ( $format ) {
			$demo_data = self::get_demo_tracking_data();
			if ( $use_locale ) {
				foreach ( $demo_data as $event ) {
					$date = new WC_DateTime( $event['time'] );

					$results[] = $date->date_i18n( $format );
				}
			} else {
				foreach ( $demo_data as $event ) {
					$results[] = date_format( date_create( $event['time'] ), $format );
				}
			}
			$response['status']  = 'success';
			$response['results'] = $results;
		}
		wp_send_json( $response );
	}

	public function design_option_customizer( $wp_customize ) {
		/*wpml*/
		if ( is_plugin_active( 'sitepress-multilingual-cms/sitepress.php' ) ) {
			global $sitepress;
			$default_lang           = $sitepress->get_default_language();
			$this->default_language = $default_lang;
			$languages              = apply_filters( 'wpml_active_languages', null, null );
			$this->languages_data   = $languages;
			if ( count( $languages ) ) {
				foreach ( $languages as $key => $language ) {
					if ( $key != $default_lang ) {
						$this->languages[] = $key;
					}
				}
			}
		} elseif ( class_exists( 'Polylang' ) ) {
			/*Polylang*/
			$languages    = pll_languages_list();
			$default_lang = pll_default_language( 'slug' );
			foreach ( $languages as $language ) {
				if ( $language == $default_lang ) {
					continue;
				}
				$this->languages[] = $language;
			}
		}
		$this->add_section_design( $wp_customize );
		$this->add_section_design_general( $wp_customize );
		$this->add_section_design_tracking_form( $wp_customize );
		$this->add_section_design_template_one( $wp_customize );
		$this->add_section_design_custom_css( $wp_customize );
	}

	/**
	 * @param $wp_customize WP_Customize_Manager
	 */
	protected function add_section_design( $wp_customize ) {
		$wp_customize->add_panel( 'vi_wot_orders_tracking_design', array(
			'priority'       => 200,
			'capability'     => $this->capability,
			'theme_supports' => '',
			'title'          => esc_html__( 'WooCommerce Orders Tracking ', 'woocommerce-orders-tracking' ),
		) );
		$wp_customize->add_section( 'vi_wot_orders_tracking_design_general', array(
			'priority'       => 20,
			'capability'     => $this->capability,
			'theme_supports' => '',
			'title'          => esc_html__( 'General', 'woocommerce-orders-tracking' ),
			'panel'          => 'vi_wot_orders_tracking_design',
		) );
		$wp_customize->add_section( 'vi_wot_orders_tracking_design_tracking_form', array(
			'priority'       => 20,
			'capability'     => $this->capability,
			'theme_supports' => '',
			'title'          => esc_html__( 'Tracking form', 'woocommerce-orders-tracking' ),
			'panel'          => 'vi_wot_orders_tracking_design',
		) );
		$wp_customize->add_section( 'vi_wot_orders_tracking_design_template_one', array(
			'priority'       => 20,
			'capability'     => $this->capability,
			'theme_supports' => '',
			'title'          => esc_html__( 'Design Template One', 'woocommerce-orders-tracking' ),
			'panel'          => 'vi_wot_orders_tracking_design',
		) );
		$wp_customize->add_section( 'vi_wot_orders_tracking_design_custom_css', array(
			'priority'       => 20,
			'capability'     => $this->capability,
			'theme_supports' => '',
			'title'          => esc_html__( 'Custom Css', 'woocommerce-orders-tracking' ),
			'panel'          => 'vi_wot_orders_tracking_design',
		) );
	}

	/**
	 * @param $wp_customize WP_Customize_Manager
	 */
	protected function add_section_design_tracking_form( $wp_customize ) {
		$wp_customize->add_setting( 'woo_orders_tracking_settings[tracking_form_email]', array(
			'default'           => $this->settings->get_params( 'tracking_form_email' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control( 'woo_orders_tracking_settings[tracking_form_email]', array(
			'type'     => 'checkbox',
			'priority' => 10,
			'section'  => 'vi_wot_orders_tracking_design_tracking_form',
			'label'    => esc_html__( 'Email field', 'woocommerce-orders-tracking' ),
		) );
		$wp_customize->add_setting( 'woo_orders_tracking_settings[tracking_form_require_email]', array(
			'default'           => $this->settings->get_params( 'tracking_form_require_email' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control( 'woo_orders_tracking_settings[tracking_form_require_email]', array(
			'type'     => 'checkbox',
			'priority' => 10,
			'section'  => 'vi_wot_orders_tracking_design_tracking_form',
			'label'    => esc_html__( 'Require Email', 'woocommerce-orders-tracking' ),
		) );
		$wp_customize->add_setting( 'woo_orders_tracking_settings[tracking_form_order_id]', array(
			'default'           => $this->settings->get_params( 'tracking_form_order_id' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control( 'woo_orders_tracking_settings[tracking_form_order_id]', array(
			'type'     => 'checkbox',
			'priority' => 10,
			'section'  => 'vi_wot_orders_tracking_design_tracking_form',
			'label'    => esc_html__( 'Order ID field', 'woocommerce-orders-tracking' ),
		) );
		$wp_customize->add_setting( 'woo_orders_tracking_settings[tracking_form_require_order_id]', array(
			'default'           => $this->settings->get_params( 'tracking_form_require_order_id' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control( 'woo_orders_tracking_settings[tracking_form_require_order_id]', array(
			'type'     => 'checkbox',
			'priority' => 10,
			'section'  => 'vi_wot_orders_tracking_design_tracking_form',
			'label'    => esc_html__( 'Require Order ID', 'woocommerce-orders-tracking' ),
		) );
		$wp_customize->add_setting( 'woo_orders_tracking_settings[tracking_form_require_tracking_number]', array(
			'default'           => $this->settings->get_params( 'tracking_form_require_tracking_number' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control( 'woo_orders_tracking_settings[tracking_form_require_tracking_number]', array(
			'type'     => 'checkbox',
			'priority' => 10,
			'section'  => 'vi_wot_orders_tracking_design_tracking_form',
			'label'    => esc_html__( 'Require Tracking number', 'woocommerce-orders-tracking' ),
		) );
		/*Button track*/
		$wp_customize->add_setting( 'woo_orders_tracking_settings[tracking_form_button_track_title]', array(
			'default'           => $this->settings->get_params( 'tracking_form_button_track_title' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control( 'woo_orders_tracking_settings[tracking_form_button_track_title]', array(
			'type'     => 'text',
			'priority' => 10,
			'section'  => 'vi_wot_orders_tracking_design_tracking_form',
			'label'    => esc_html__( 'Track button title', 'woocommerce-orders-tracking' ),
		) );
		if ( count( $this->languages ) ) {
			foreach ( $this->languages as $key => $value ) {
				$wp_customize->add_setting( "woo_orders_tracking_settings[tracking_form_button_track_title_{$value}]", array(
					'default'           => $this->settings->get_params( 'tracking_form_button_track_title', '', $value ),
					'type'              => 'option',
					'capability'        => $this->capability,
					'sanitize_callback' => 'sanitize_text_field',
					'transport'         => 'postMessage',
				) );
				$label = esc_html__( 'Track button title', 'woocommerce-orders-tracking' ) . "({$value})";
				if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
					$label = esc_html__( 'Track button title', 'woocommerce-orders-tracking' ) . "({$value}-{$this->languages_data[ $value ]['translated_name']})";
				}
				$wp_customize->add_control( "woo_orders_tracking_settings[tracking_form_button_track_title_{$value}]", array(
					'type'     => 'text',
					'priority' => 10,
					'section'  => 'vi_wot_orders_tracking_design_tracking_form',
					'label'    => $label,
				) );
			}
		}
		$wp_customize->add_setting( 'woo_orders_tracking_settings[tracking_form_button_track_color]', array(
			'default'           => $this->settings->get_params( 'tracking_form_button_track_color' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control(
			new WP_Customize_Color_Control(
				$wp_customize,
				'woo_orders_tracking_settings[tracking_form_button_track_color]',
				array(
					'label'   => esc_html__( 'Track button text color', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_tracking_form',
				) )
		);
		$wp_customize->add_setting( 'woo_orders_tracking_settings[tracking_form_button_track_bg_color]', array(
			'default'           => $this->settings->get_params( 'tracking_form_button_track_bg_color' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control(
			new WP_Customize_Color_Control(
				$wp_customize,
				'woo_orders_tracking_settings[tracking_form_button_track_bg_color]',
				array(
					'label'   => esc_html__( 'Track button background color', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_tracking_form',
				) )
		);
	}

	/**
	 * @param $wp_customize WP_Customize_Manager
	 */
	protected function add_section_design_general( $wp_customize ) {
		/*
		 * sort events
		 */
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_sort_event]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_sort_event' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control( 'woo_orders_tracking_settings[timeline_track_info_sort_event]', array(
			'type'     => 'select',
			'priority' => 10,
			'section'  => 'vi_wot_orders_tracking_design_general',
			'label'    => esc_html__( 'Sort events', 'woocommerce-orders-tracking' ),
			'choices'  => array(
				'most_recent_to_oldest' => esc_html__( 'Most recent to oldest', 'woocommerce-orders-tracking' ),
				'oldest_to_most_recent' => esc_html__( 'Oldest to most recent', 'woocommerce-orders-tracking' ),
			)
		) );

		/*
		 * Date format
		 */
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_date_format]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_date_format' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$support_date_formats = array();
		foreach (
			array(
				'j F, Y',
				'Y-m-d',
				'm/d/Y',
				'd/m/Y',
			) as $support_date_format
		) {
			$support_date_formats[ $support_date_format ] = esc_html( date( $support_date_format ) . " ( {$support_date_format} )" );
		}
		$wp_customize->add_control( 'woo_orders_tracking_settings[timeline_track_info_date_format]', array(
			'type'     => 'select',
			'priority' => 10,
			'section'  => 'vi_wot_orders_tracking_design_general',
			'label'    => esc_html__( 'Date format', 'woocommerce-orders-tracking' ),
			'choices'  => $support_date_formats
		) );
		/*
		 * time format
		 */
		$support_time_formats = array();
		foreach (
			array(
				'g:i a',
				'g:i A',
				'H:i',
			) as $support_time_format
		) {
			$support_time_formats[ $support_time_format ] = esc_html( date( $support_time_format ) . " ( {$support_time_format} )" );
		}
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_time_format]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_time_format' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control( 'woo_orders_tracking_settings[timeline_track_info_time_format]', array(
			'type'     => 'select',
			'priority' => 10,
			'section'  => 'vi_wot_orders_tracking_design_general',
			'label'    => esc_html__( 'Time format', 'woocommerce-orders-tracking' ),
			'choices'  => $support_time_formats
		) );
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_datetime_format_locale]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_datetime_format_locale' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control( 'woo_orders_tracking_settings[timeline_track_info_datetime_format_locale]', array(
			'type'     => 'checkbox',
			'priority' => 10,
			'section'  => 'vi_wot_orders_tracking_design_general',
			'label'    => esc_html__( 'By default, datetime is in English. If checked, it will be translated to your site\'s locale', 'woocommerce-orders-tracking' ),
		) );
		/*
		 * template
		 */
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_template]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_template' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control( 'woo_orders_tracking_settings[timeline_track_info_template]', array(
			'type'     => 'select',
			'priority' => 10,
			'section'  => 'vi_wot_orders_tracking_design_general',
			'label'    => esc_html__( 'Timeline template', 'woocommerce-orders-tracking' ),
			'choices'  => array(
				'1' => esc_html__( 'Template one', 'woocommerce-orders-tracking' ),
				'2' => esc_html__( 'Template two', 'woocommerce-orders-tracking' ),
			)
		) );


		//template title
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_title]', array(
			'default'           => htmlentities( $this->settings->get_params( 'timeline_track_info_title' ) ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control( 'woo_orders_tracking_settings[timeline_track_info_title]', array(
			'label'       => esc_html__( 'Title', 'woocommerce-orders-tracking' ),
			'type'        => 'text',
			'section'     => 'vi_wot_orders_tracking_design_general',
			'description' => '<p >{tracking_number}:' . esc_html__( 'The tracking number', 'woocommerce-orders-tracking' ) . '</p> <p >{carrier_name}:' . esc_html__( 'The name of carrier', 'woocommerce-orders-tracking' ) . '</p>'
		) );


		//template title alignment
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_title_alignment]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_title_alignment' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control( 'woo_orders_tracking_settings[timeline_track_info_title_alignment]', array(
			'type'     => 'select',
			'priority' => 10,
			'section'  => 'vi_wot_orders_tracking_design_general',
			'label'    => esc_html__( 'Title text alignment', 'woocommerce-orders-tracking' ),
			'choices'  => array(
				'center' => esc_html__( 'Center', 'woocommerce-orders-tracking' ),
				'left'   => esc_html__( 'Left', 'woocommerce-orders-tracking' ),
				'right'  => esc_html__( 'Right', 'woocommerce-orders-tracking' ),
			)
		) );

		//template title text color
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_title_color]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_title_color' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control(
			new WP_Customize_Color_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_title_color]',
				array(
					'label'   => esc_html__( 'Title text color', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_general',
				) )
		);

		//template title font size

		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_title_font_size]', array(
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => $this->settings->get_params( 'timeline_track_info_title_font_size' ),
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control( 'woo_orders_tracking_settings[timeline_track_info_title_font_size]', array(
			'type'        => 'number',
			'section'     => 'vi_wot_orders_tracking_design_general',
			'label'       => esc_html__( 'Title font size', 'woocommerce-orders-tracking' ),
			'input_attrs' => array(
				'min'  => 13,
				'step' => 1,
				'max'  => 60
			),
		) );


		//template status text color
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_status_color]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_status_color' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control(
			new WP_Customize_Color_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_status_color]',
				array(
					'label'   => esc_html__( 'Shipment status text color', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_general',
				) )
		);

		//template status background delivered
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_status_background_delivered]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_status_background_delivered' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control(
			new WP_Customize_Color_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_status_background_delivered]',
				array(
					'label'   => esc_html__( 'Shipment delivered background color', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_general',
				) )
		);

		//template status background pickup
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_status_background_pickup]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_status_background_pickup' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control(
			new WP_Customize_Color_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_status_background_pickup]',
				array(
					'label'   => esc_html__( 'Shipment pickup background color', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_general',
				) )
		);
		//template status background pickup
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_status_background_transit]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_status_background_transit' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control(
			new WP_Customize_Color_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_status_background_transit]',
				array(
					'label'   => esc_html__( 'Shipment transit background color', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_general',
				) )
		);

		//template status background pickup
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_status_background_pending]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_status_background_pending' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control(
			new WP_Customize_Color_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_status_background_pending]',
				array(
					'label'   => esc_html__( 'Shipment pending background color', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_general',
				) )
		);
		//template status background pickup
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_status_background_alert]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_status_background_alert' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control(
			new WP_Customize_Color_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_status_background_alert]',
				array(
					'label'   => esc_html__( 'Shipment alert background color', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_general',
				) )
		);
	}

	/**
	 * @param $wp_customize WP_Customize_Manager
	 */
	protected function add_section_design_template_one( $wp_customize ) {
		//set delivered icon
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_template_one][icon_delivered]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_template_one', 'icon_delivered' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control(
			new VI_WOT_Customize_Radio_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_template_one][icon_delivered]',
				array(
					'label'   => esc_html__( 'Delivered icon', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_template_one',
					'choices' => VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_delivered_icons()
				)
			)
		);

		//delivered icon color
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_template_one][icon_delivered_color]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_template_one', 'icon_delivered_color' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control(
			new WP_Customize_Color_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_template_one][icon_delivered_color]',
				array(
					'label'   => esc_html__( 'Delivered icon color', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_template_one',
				) )
		);
		//set pickup icon
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_template_one][icon_pickup]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_template_one', 'icon_pickup' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control(
			new VI_WOT_Customize_Radio_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_template_one][icon_pickup]',
				array(
					'label'   => esc_html__( 'Pickup icon', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_template_one',
					'choices' => VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_pickup_icons()
				)
			)
		);

		//pickup icon color
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_template_one][icon_pickup_color]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_template_one', 'icon_pickup_color' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control(
			new WP_Customize_Color_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_template_one][icon_pickup_color]',
				array(
					'label'   => esc_html__( 'Pickup icon color', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_template_one',
				) )
		);
		//pickup icon background
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_template_one][icon_pickup_background]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_template_one', 'icon_pickup_background' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control(
			new WP_Customize_Color_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_template_one][icon_pickup_background]',
				array(
					'label'   => esc_html__( 'Pickup icon background', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_template_one',
				) )
		);
		//set other status icon
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_template_one][icon_transit]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_template_one', 'icon_transit' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control(
			new VI_WOT_Customize_Radio_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_template_one][icon_transit]',
				array(
					'label'   => esc_html__( 'In-transit status icon', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_template_one',
					'choices' => VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_transit_icons()
				)
			)
		);

		//other statsu icon color
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_template_one][icon_transit_color]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_template_one', 'icon_transit_color' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control(
			new WP_Customize_Color_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_template_one][icon_transit_color]',
				array(
					'label'   => esc_html__( 'In-transit status icon color', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_template_one',
				) )
		);
		//other status icon background
		$wp_customize->add_setting( 'woo_orders_tracking_settings[timeline_track_info_template_one][icon_transit_background]', array(
			'default'           => $this->settings->get_params( 'timeline_track_info_template_one', 'icon_transit_background' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );

		$wp_customize->add_control(
			new WP_Customize_Color_Control(
				$wp_customize,
				'woo_orders_tracking_settings[timeline_track_info_template_one][icon_transit_background]',
				array(
					'label'   => esc_html__( 'In-transit status icon background', 'woocommerce-orders-tracking' ),
					'section' => 'vi_wot_orders_tracking_design_template_one',
				) )
		);
	}

	/**
	 * @param $wp_customize WP_Customize_Manager
	 */
	protected function add_section_design_custom_css( $wp_customize ) {
		$wp_customize->add_setting( 'woo_orders_tracking_settings[custom_css]', array(
			'default'           => $this->settings->get_default( 'custom_css' ),
			'type'              => 'option',
			'capability'        => $this->capability,
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'postMessage',
		) );
		$wp_customize->add_control( 'woo_orders_tracking_settings[custom_css]', array(
			'type'     => 'textarea',
			'priority' => 10,
			'section'  => 'vi_wot_orders_tracking_design_custom_css',
			'label'    => esc_html__( 'Custom CSS', 'woocommerce-orders-tracking' )
		) );
	}

	/**
	 *
	 */
	public function customize_controls_print_styles() {
		if ( ! is_customize_preview() ) {
			return;
		}
		$service_tracking_page = $this->settings->get_params( 'service_tracking_page' );
		$template=$this->settings->get_params('timeline_track_info_template')? $this->settings->get_params('timeline_track_info_template'):$this->settings->get_default('timeline_track_info_template');
		$template_css = '';
		switch ($template){
			case '1':
				$template_css = '.woo-orders-tracking-preview-shortcode-template-two { display: none !important; } .woo-orders-tracking-preview-shortcode-template-one { display: block; }';
				break;
			case '2':
				$template_css = '.woo-orders-tracking-preview-shortcode-template-two { display: block;}.woo-orders-tracking-preview-shortcode-template-one { display: none !important;}';
				break;
		}
		$this->add_preview_style( 'custom-css', '', '', '','',$this->settings->get_params('custom_css') );
		$this->add_preview_style( 'show-timeline', '', '', '','',(!$service_tracking_page || !get_the_permalink( $service_tracking_page ) ) ?'.woo-orders-tracking-shortcode-timeline-wrap {display: none !important;}' : '.woo-orders-tracking-shortcode-timeline-wrap {display: block;}' );
		$this->add_preview_style( 'show-timeline-template', '', '', '','',$template_css );
		$this->add_preview_style( 'timeline_track_info_title_alignment', '.woo-orders-tracking-shortcode-timeline-wrap .woo-orders-tracking-shortcode-timeline-title', 'text-align', '' );
		$this->add_preview_style( 'timeline_track_info_title_color', '.woo-orders-tracking-shortcode-timeline-wrap .woo-orders-tracking-shortcode-timeline-title', 'color', '' );
		$this->add_preview_style( 'timeline_track_info_title_font_size', '.woo-orders-tracking-shortcode-timeline-wrap .woo-orders-tracking-shortcode-timeline-title', 'font-size', 'px' );

		$this->add_preview_style( 'timeline_track_info_status_color', '.woo-orders-tracking-shortcode-timeline-wrap .woo-orders-tracking-shortcode-timeline-status-wrap', 'color', '' );
		$this->add_preview_style( 'timeline_track_info_status_background_delivered', '.woo-orders-tracking-shortcode-timeline-wrap .woo-orders-tracking-shortcode-timeline-status-wrap.woo-orders-tracking-shortcode-timeline-status-delivered', 'background-color', '' );
		$this->add_preview_style( 'timeline_track_info_status_background_pickup', '.woo-orders-tracking-shortcode-timeline-wrap .woo-orders-tracking-shortcode-timeline-status-wrap.woo-orders-tracking-shortcode-timeline-status-pickup', 'background-color', '' );
		$this->add_preview_style( 'timeline_track_info_status_background_transit', '.woo-orders-tracking-shortcode-timeline-wrap .woo-orders-tracking-shortcode-timeline-status-wrap.woo-orders-tracking-shortcode-timeline-status-transit', 'background-color', '' );
		$this->add_preview_style( 'timeline_track_info_status_background_alert', '.woo-orders-tracking-shortcode-timeline-wrap .woo-orders-tracking-shortcode-timeline-status-wrap.woo-orders-tracking-shortcode-timeline-status-alert', 'background-color', '' );
		$this->add_preview_style( 'timeline_track_info_status_background_pending', '.woo-orders-tracking-shortcode-timeline-wrap .woo-orders-tracking-shortcode-timeline-status-wrap.woo-orders-tracking-shortcode-timeline-status-pending', 'background-color', '' );

		//template one
		$this->add_preview_style( 'icon_delivered_color',
			'.woo-orders-tracking-shortcode-timeline-wrap.woo-orders-tracking-shortcode-timeline-wrap-template-one .woo-orders-tracking-shortcode-timeline-events-wrap .woo-orders-tracking-shortcode-timeline-event .woo-orders-tracking-shortcode-timeline-icon-delivered i:before',
			'color', '', 'timeline_track_info_template_one' );

		$this->add_preview_style( 'icon_pickup_color',
			'.woo-orders-tracking-shortcode-timeline-wrap.woo-orders-tracking-shortcode-timeline-wrap-template-one .woo-orders-tracking-shortcode-timeline-events-wrap .woo-orders-tracking-shortcode-timeline-event .woo-orders-tracking-shortcode-timeline-icon-pickup i:before',
			'color', '', 'timeline_track_info_template_one' );
		$this->add_preview_style( 'icon_pickup_background',
			'.woo-orders-tracking-shortcode-timeline-wrap.woo-orders-tracking-shortcode-timeline-wrap-template-one .woo-orders-tracking-shortcode-timeline-events-wrap .woo-orders-tracking-shortcode-timeline-event .woo-orders-tracking-shortcode-timeline-icon-pickup',
			'background-color', '', 'timeline_track_info_template_one' );

		$this->add_preview_style( 'icon_transit_color',
			'.woo-orders-tracking-shortcode-timeline-wrap.woo-orders-tracking-shortcode-timeline-wrap-template-one
.woo-orders-tracking-shortcode-timeline-events-wrap
.woo-orders-tracking-shortcode-timeline-event
.woo-orders-tracking-shortcode-timeline-icon-transit i:before',
			'color', '', 'timeline_track_info_template_one' );
		$this->add_preview_style( 'icon_transit_background',
			'.woo-orders-tracking-shortcode-timeline-wrap.woo-orders-tracking-shortcode-timeline-wrap-template-one
.woo-orders-tracking-shortcode-timeline-events-wrap
.woo-orders-tracking-shortcode-timeline-event
.woo-orders-tracking-shortcode-timeline-icon-transit',
			'background-color', '', 'timeline_track_info_template_one' );

	}
	private function add_preview_style( $name, $element, $style, $suffix = '', $type = '', $css=null ) {
		if (!$name){
			return ;
		}
		$id_css = $this->set( 'preview-' ) . str_replace( '_', '-', $name );
		if (!wp_style_is($id_css)){
			wp_register_style( $id_css, false,'', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			wp_enqueue_style($id_css);
			if ($css === null) {
				$value = $type ? $this->settings->get_params( $type, $name ) : $this->settings->get_params( $name );
				$css   = $element . '{' . ( ( $value === '' ) ? '' : ( $style . ':' . $value . $suffix ) ) . '}';
			}elseif (!$css){
				$css = '.viwot_cusstom_css{}';
			}
			wp_add_inline_style( $id_css, $css );
		}
	}

	/**
	 *
	 */
	public function customize_controls_enqueue_scripts() {
		wp_enqueue_style( 'vi-wot-customize-preview-style', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'customize-preview.css', array(), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'vi-wot-customize-icon', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'frontend-shipment-icon.css', array(), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_script( 'viwot-customize-preview-settings', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'customize-settings.js', array( 'jquery', ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, true );
		$tracking_page     = $this->settings->get_params( 'service_tracking_page' );
		$tracking_page_url = '';
		if ( $tracking_page ) {
			$tracking_page_url = get_permalink( $tracking_page );
		}
		wp_localize_script( 'viwot-customize-preview-settings', 'viwot_preview_setting', ['tracking_page_url'=>$tracking_page_url] );
	}

	/**
	 *
	 */
	public function customize_preview_init() {
		wp_enqueue_script( 'vi-wot-customize-preview-js', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'customize-preview.js', array(
			'jquery',
			'customize-preview',
			'select2',
		), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, true );

		wp_localize_script( 'vi-wot-customize-preview-js', 'vi_wot_customize_params', array(
			'ajax_url'                           => admin_url( 'admin-ajax.php' ),
			'service_carrier_type'               => $this->settings->get_params( 'service_carrier_type' ),
			'delivered_icons'                    => VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_delivered_icons(),
			'pickup_icons'                       => VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_pickup_icons(),
			'transit_icons'                      => VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_transit_icons(),
			'i18n_track'                         => esc_html__( 'Track', 'woocommerce-orders-tracking' ),
			'i18n_email'                         => esc_html__( 'Your email', 'woocommerce-orders-tracking' ),
			'i18n_email_require'                 => esc_html__( 'Your email(*Required)', 'woocommerce-orders-tracking' ),
			'i18n_order_id'                      => esc_html__( 'Order ID', 'woocommerce-orders-tracking' ),
			'i18n_order_id_require'              => esc_html__( 'Order ID(*Required)', 'woocommerce-orders-tracking' ),
			'i18n_order_tracking_number'         => esc_html__( 'Tracking number', 'woocommerce-orders-tracking' ),
			'i18n_order_tracking_number_require' => esc_html__( 'Tracking number(*Required)', 'woocommerce-orders-tracking' ),
			'languages'                          => $this->languages,
		) );
	}


	private function set( $name ) {
		if ( is_array( $name ) ) {
			return implode( ' ', array_map( array( $this, 'set' ), $name ) );

		} else {
			return esc_attr( $this->prefix . $name );

		}
	}

	public static function get_demo_tracking_data() {
		return array(
			array(
				'description' => esc_html__( 'Description for event (status: Delivered)', 'woocommerce-orders-tracking' ),
				'location'    => esc_html__( 'Thai Nguyen, VietNam', 'woocommerce-orders-tracking' ),
				'status'      => 'delivered',
				'time'        => '2020-01-11 9:50:12',
			),
			array(
				'description' => esc_html__( 'Description for event (status: In transit)', 'woocommerce-orders-tracking' ),
				'location'    => esc_html__( 'Thai Nguyen, VietNam', 'woocommerce-orders-tracking' ),
				'status'      => 'transit',
				'time'        => '2020-01-03 22:11:33',
			),
			array(
				'description' => esc_html__( 'Description for event (status: In transit)', 'woocommerce-orders-tracking' ),
				'location'    => esc_html__( 'Thai Nguyen, VietNam', 'woocommerce-orders-tracking' ),
				'status'      => 'transit',
				'time'        => '2020-01-03 2:15:30',
			),
			array(
				'description' => esc_html__( 'Description for event (status: Pickup)', 'woocommerce-orders-tracking' ),
				'location'    => esc_html__( 'Thai Nguyen, VietNam', 'woocommerce-orders-tracking' ),
				'status'      => 'pickup',
				'time'        => '2020-01-01 1:22:34',
			),
			array(
				'description' => esc_html__( 'Description for event (status: Pending)', 'woocommerce-orders-tracking' ),
				'location'    => esc_html__( 'Thai Nguyen, VietNam', 'woocommerce-orders-tracking' ),
				'status'      => '',
				'time'        => '2020-01-01 00:00:00',
			),
		);
	}
}