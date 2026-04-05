<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_VITRACKING' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_VITRACKING {
		public static function track_with_vitracking($tracking_code, $tracking_from_db, $service_carrier_type, &$found_tracking, $modified_at_real = ''){
			if ( $service_carrier_type !== 'vitracking' ) {
				return;
			}
			if (!is_array($tracking_from_db)  ||  empty( $tracking_from_db ) ) {
				return;
			}
			$now = time();
			if ( ! isset( $tracking_from_db['id'] ) ) {
				$tracking_from_db = $tracking_from_db[0];
			}
			if ( ! $tracking_code ) {
				$tracking_code = $tracking_from_db['tracking_number'];
			}
			$modified_at    = $tracking_from_db['modified_at'];
			$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
			if ( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $tracking_from_db['status'] ) === 'delivered' && $tracking_from_db['track_info'] ) {
				$track_info   = vi_wot_json_decode( $tracking_from_db['track_info'] );
				$carrier_name = $tracking_from_db['carrier_id'];
				$display_name = $carrier_name;
				$carrier      = $settings->get_shipping_carrier_by_slug( $tracking_from_db['carrier_id'] );
				if ( is_array( $carrier ) && count( $carrier ) ) {
					$carrier_name = $carrier['name'];
					$display_name = empty( $carrier['display_name'] ) ? $carrier_name : $carrier['display_name'];
				}
				VI_WOOCOMMERCE_ORDERS_TRACKING_FRONTEND_FRONTEND::display_timeline( array(
					'status'            => $tracking_from_db['status'],
					'tracking'          => $track_info,
					'last_event'        => $tracking_from_db['last_event'],
					'carrier_name'      => $display_name,
					'est_delivery_date' => isset( $tracking_from_db['est_delivery_date'] ) ? $tracking_from_db['est_delivery_date'] : '',
					'modified_at'       => $modified_at_real ?: $tracking_from_db['modified_at'],
					'order_id'          => $tracking_from_db['order_id'],
				), $tracking_code );
				return;
			}
			if ( ( $now - strtotime( $modified_at ) ) > $settings->get_cache_request_time() ) {
				$found_tracking = true;
				$carrier_name = $tracking_from_db['carrier_id'];
				$display_name = $carrier_name;
				$carrier      = $settings->get_shipping_carrier_by_slug( $tracking_from_db['carrier_id'] );
				if ( is_array( $carrier ) && count( $carrier ) ) {
					$carrier_name = $carrier['name'];
					$display_name = empty( $carrier['display_name'] ) ? $carrier_name : $carrier['display_name'];
				}
				self::vitracking_search_tracking( $tracking_code, $found_tracking, $tracking_from_db, $service_carrier_type, $carrier_name, $display_name );
			}
			if ( !$found_tracking && $tracking_from_db['track_info'] ) {
				$found_tracking = true;
				$track_info     = vi_wot_json_decode( $tracking_from_db['track_info'] );
				$carrier_name   = $tracking_from_db['carrier_id'];
				$display_name   = $carrier_name;
				$carrier        = $settings->get_shipping_carrier_by_slug( $tracking_from_db['carrier_id'] );
				if ( is_array( $carrier ) && count( $carrier ) ) {
					$carrier_name = $carrier['name'];
					$display_name = empty( $carrier['display_name'] ) ? $carrier_name : $carrier['display_name'];
				}
				VI_WOOCOMMERCE_ORDERS_TRACKING_FRONTEND_FRONTEND::display_timeline( array(
					'status'            => $tracking_from_db['status'],
					'tracking'          => $track_info,
					'last_event'        => $tracking_from_db['last_event'],
					'carrier_name'      => $display_name,
					'est_delivery_date' => isset( $tracking_from_db['est_delivery_date'] ) ? $tracking_from_db['est_delivery_date'] : '',
					'modified_at'       => $tracking_from_db['modified_at'],
					'order_id'          => $tracking_from_db['order_id'],
				), $tracking_code );
			}
		}

		/**
		 * @param $tracking_code
		 * @param $found_tracking
		 * @param $tracking_from_db
		 * @param $service_carrier_type
		 * @param $carrier_name
		 * @param $display_name
		 *
		 * @throws Exception
		 */
		public static function vitracking_search_tracking( $tracking_code, &$found_tracking, $tracking_from_db, $service_carrier_type, $carrier_name, $display_name ) {
			$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
			$found_tracking = false;
			$service_carrier_api_key = $settings->get_params( 'service_carrier_api_key' );
			$url            = "https://vitracking.com/wp-json/tracking-service/get-tracking?tracking_number={$tracking_code}";
			$request_data   = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_get( $url, [
				'headers' => [ 'Authorization' => $service_carrier_api_key, 'Referer' => get_site_url() ]
			]  );
			if (($request_data['status'] ??'') !== 'success' || empty($request_data['data'])){
				return;
			}
			$tracking = vi_wot_json_decode( $request_data['data'] );
			if (empty($tracking['data']['states'])){
				return;
			}
			$found_tracking = true;
			$track_info_args = $tracking['data']['states'];
			foreach ( $track_info_args as &$item){
				$item['description'] = $item['status'];
				$item['time'] = $item['date'];
			}
			$track_info     = vi_wot_json_encode( $track_info_args );
			$last_event     = $track_info_args[0];
			$tracking_status = $tracking['data']['sub_status']??'';
			if ( $tracking_from_db['id'] ) {
				VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], '', $tracking_from_db['carrier_id'], '', $tracking_status, $track_info, $last_event['description'], '' );
			}else{
				VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_code, $tracking_from_db['order_id'], $tracking_from_db['carrier_id'], $service_carrier_type, $tracking_status, $track_info, $last_event['description'], '', false );
			}
			$convert_status = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $tracking_status);
			if ( $convert_status !== VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $tracking_from_db['status'] ) || $track_info !== $tracking_from_db['track_info'] ) {
				VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ORDERS_TRACK_INFO::update_order_items_tracking_status( $tracking_code, $tracking_from_db['carrier_id'], $last_event['status'], $settings->get_params( 'change_order_status' ) );
			}
			VI_WOOCOMMERCE_ORDERS_TRACKING_FRONTEND_FRONTEND::display_timeline( array(
				'status'            => $tracking_status,
				'tracking'          => $track_info_args,
				'last_event'        => $last_event,
				'carrier_name'      => $display_name,
				'est_delivery_date' => $tracking_from_db['est_delivery_date'] ?? '',
				'modified_at'       => date( 'Y-m-d H:i:s' ),
				'order_id'          => $tracking_from_db['order_id'],
			), $tracking_code );
		}
	}
}