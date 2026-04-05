<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP {
		protected $settings;
		protected $service_carrier_api_key;
		protected static $search_tracking_slugs;

		public function __construct( $service_carrier_api_key ) {
			$this->service_carrier_api_key = $service_carrier_api_key;
		}

		public function create( $tracking_number, $carrier_slug, $order_id ) {
			$return = array(
				'status'            => 'error',
				'est_delivery_date' => '',
				'code'              => '',
				'data'              => esc_html__( 'Can not create tracker', 'woocommerce-orders-tracking' ),
			);
			if ( $this->service_carrier_api_key ) {
				$order = wc_get_order( $order_id );
				if ( $order ) {
					$url      = 'https://api.aftership.com/v4/trackings';
					$tracking = array(
						'slug'            => $carrier_slug,
						'tracking_number' => $tracking_number,
						'order_id'        => $order_id,
						'emails'          => $order->get_billing_email(),
						'customer_name'   => $order->get_billing_first_name(),
						'language'        => 'en',
					);
					$mobile   = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::format_phone_number( $order->get_billing_phone(), $order->get_shipping_country() );
					if ( $mobile ) {
						$tracking['smses'] = $mobile;
					}
					$args         = array(
						'headers' => array(
							'aftership-api-key' => $this->service_carrier_api_key,
							'Content-Type'      => 'application/json'
						),
						'body'    => vi_wot_json_encode( array(
							'tracking' => $tracking
						) )
					);
					$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_post( $url, $args );
					if ( $request_data['status'] === 'success' ) {
						$body = vi_wot_json_decode( $request_data['data'] );
						if ( $body['meta']['code'] == 201 ) {
							$return['status'] = 'success';
							$return['data']   = $body['data']['tracking'];
						} else {
							$return['code'] = $body['meta']['code'];
							$return['data'] = $body['meta']['message'];
						}
					} else {
						$return['data'] = $request_data['data'];
					}
				} else {
					$return['data'] = esc_html__( 'Order not found', 'woocommerce-orders-tracking' );
				}
			} else {
				$return['data'] = esc_html__( 'Empty API', 'woocommerce-orders-tracking' );
			}

			return $return;
		}

		public static function get_track_info( $checkpoints ) {
			$track_info = array();

			if ( is_array( $checkpoints ) && count( $checkpoints ) ) {
				foreach ( $checkpoints as $tracking ) {
					$track_info[] = array(
						'time'        => $tracking['checkpoint_time'],
						'description' => $tracking['message'],
						'location'    => $tracking['location'],
						'status'      => $tracking['tag'],
					);
				}
				krsort( $track_info );
			}

			return array_values( $track_info );
		}

		public function get_tracking_data( $tracking_number, $carrier_slug ) {
			$response     = array(
				'status'              => 'error',
				'est_delivery_date'   => '',
				'origin_country'      => '',
				'destination_country' => '',
				'data'                => esc_html__( 'Tracking not found', 'woocommerce-orders-tracking' ),
				'code'                => '',
			);
			$request_data = $this->request_tracking_data( $tracking_number, $carrier_slug );
			if ( $request_data['status'] === 'success' ) {
				$tracking_data = $request_data['data'];
				if ( is_array( $tracking_data ) && count( $tracking_data ) ) {
					$checkpoints                     = $tracking_data['checkpoints'];
					$response['status']              = 'success';
					$response['est_delivery_date']   = $tracking_data['expected_delivery'];
					$response['origin_country']      = $tracking_data['origin_country_iso3'];
					$response['destination_country'] = $tracking_data['destination_country_iso3'];
					$response['data']                = self::get_track_info( $checkpoints );
				}
			} else {
				$response['code'] = $request_data['code'];
				$response['data'] = $request_data['data'];
			}

			return $response;
		}

		public function request_tracking_data( $tracking_number, $carrier_slug ) {
			$return = array(
				'status' => 'error',
				'data'   => '',
				'code'   => '',
			);
			if ( $this->service_carrier_api_key ) {
				$url          = "https://api.aftership.com/v4/trackings/{$carrier_slug}/{$tracking_number}/?lang=en";
				$args         = array(
					'headers' => array(
						'aftership-api-key' => $this->service_carrier_api_key,
						'Content-Type'      => 'application/json'
					),
				);
				$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_get( $url, $args );
				if ( $request_data['status'] === 'success' ) {
					$body = vi_wot_json_decode( $request_data['data'] );
					if ( $body['meta']['code'] == 200 ) {
						$return['status'] = 'success';
						$return['data']   = $body['data']['tracking'];
					} else {
						$return['code'] = $body['meta']['code'];
						$return['data'] = $body['meta']['message'];
					}
				} else {
					$return['data'] = $request_data['data'];
				}
			} else {
				$return['data'] = esc_html__( 'Empty API', 'woocommerce-orders-tracking' );
			}

			return $return;
		}

		/**
		 * @param $tracking_number
		 * @param $carrier_slug
		 * @param $args array {
		 *
		 *      Optional. Array of parameters to update.
		 *
		 * @type       array $smses ,
		 * @type       array $emails ,
		 * @type       string $title ,
		 * @type       string $customer_name ,
		 * @type       string $order_id ,
		 * @type       string $order_id_path ,
		 * @type       string $language ,
		 * @type       string $note ,
		 *      ...
		 *  }
		 * @return array
		 */
		public function update( $tracking_number, $carrier_slug, $args ) {
			$return = array(
				'status'              => 'error',
				'est_delivery_date'   => '',
				'origin_country'      => '',
				'destination_country' => '',
				'data'                => '',
				'code'                => '',
			);
			if ( $this->service_carrier_api_key ) {
				$url     = "https://api.aftership.com/v4/trackings/{$carrier_slug}/{$tracking_number}/";
				$request = wp_remote_request( $url, array(
					'method'  => 'PUT',
					'headers' => array(
						'aftership-api-key' => $this->service_carrier_api_key,
						'Content-Type'      => 'application/json'
					),
					'body'    => vi_wot_json_encode( array( 'tracking' => $args ) )
				) );
				if ( ! is_wp_error( $request ) ) {
					$body = vi_wot_json_decode( $request['body'] );
					if ( $body['meta']['code'] == 200 ) {
						$return['status'] = 'success';
						$tracking_data    = $body['data']['tracking'];
						if ( is_array( $tracking_data ) && count( $tracking_data ) ) {
							$checkpoints                   = $tracking_data['checkpoints'];
							$return['est_delivery_date']   = $tracking_data['expected_delivery'];
							$return['origin_country']      = $tracking_data['origin_country_iso3'];
							$return['destination_country'] = $tracking_data['destination_country_iso3'];
							$return['data']                = self::get_track_info( $checkpoints );
						}
					} else {
						$return['code'] = $body['meta']['code'];
						$return['data'] = $body['meta']['message'];
					}
				} else {
					$return['data'] = $request->get_error_message();
				}
			} else {
				$return['data'] = esc_html__( 'Empty API', 'woocommerce-orders-tracking' );
			}

			return $return;
		}

		/**
		 * @param array $slug
		 * @param string $keyword
		 * @param string $created_at_min
		 * @param string $created_at_max
		 * @param int $page
		 * @param int $limit Result per page, max 200
		 * @param string $tag
		 *
		 * @return array
		 */
		public function request_multiple_tracking_data( $slug = array(), $keyword = '', $created_at_min = '', $created_at_max = '', $page = 1, $limit = 200, $tag = '' ) {
			$return = array(
				'status' => 'error',
				'data'   => '',
				'code'   => '',
			);
			if ( $this->service_carrier_api_key ) {
				$query_args = array(
					'page'    => $page,
					'limit'   => $limit,
					'keyword' => $keyword,
					'tag'     => $tag,
					'lang'    => 'en',
					'slug'    => implode( ',', $slug )
				);
				if ( $created_at_min ) {
					$query_args['created_at_min'] = date( 'Y-m-d\TH:i:s+00:00', strtotime( $created_at_min ) );// phpcs:ignore WordPress.DateTime.RestrictedFunctions.date_date
				}
				if ( $created_at_max ) {
					$query_args['created_at_max'] = date( 'Y-m-d\TH:i:s+00:00', strtotime( $created_at_max ) );// phpcs:ignore WordPress.DateTime.RestrictedFunctions.date_date
				}
				$url              = add_query_arg( $query_args, "https://api.aftership.com/v4/trackings/" );
				$args             = array(
					'headers' => array(
						'aftership-api-key' => $this->service_carrier_api_key,
						'Content-Type'      => 'application/json'
					),
				);
				$request_data     = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_get( $url, $args );
				$response['code'] = $request_data['code'];
				if ( $request_data['status'] === 'success' ) {
					$body = vi_wot_json_decode( $request_data['data'] );
					if ( $body['meta']['code'] == 200 ) {
						$return['status'] = 'success';
						$return['data']   = $body['data'];
					} else {
						$return['code'] = $body['meta']['code'];
						$return['data'] = $body['meta']['message'];
					}
				} else {
					$return['data'] = $request_data['data'];
				}
			} else {
				$return['data'] = esc_html__( 'Empty API', 'woocommerce-orders-tracking' );
			}

			return $return;
		}

		public function get_carriers( $all = true ) {
			$url = 'https://api.aftership.com/v4/couriers';
			if ( $all ) {
				$url .= '/all';
			}
			$args         = array(
				'headers' => array(
					'aftership-api-key' => $this->service_carrier_api_key,
					'Content-Type'      => 'application/json'
				),
			);
			$carriers     = array();
			$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_get( $url, $args );
			if ( $request_data['status'] === 'success' ) {
				$body = vi_wot_json_decode( $request_data['data'] );
				if ( $body['meta']['code'] == 200 ) {
					$carriers = $body['data']['couriers'];
				}
			}

			return $carriers;
		}

		public static function carriers() {
			$carriers = array(
				'italy-sda'                   => 'Italy SDA',
				'specialisedfreight-za'       => 'Specialised Freight',
				'ensenda'                     => 'Ensenda',
				'india-post-int'              => 'India Post International',
				'India-post-int'              => 'India Post',
				'bpost'                       => 'Bpost',
				'Bpost'                       => 'Belgium Post',
				'chronopost-portugal'         => 'Chronopost Portugal',
				'ptt-posta'                   => 'PTT Posta',
				'fastway-za'                  => 'Fastway South Africa',
				'spain-correos-es'            => 'Correos de España',
				'saudi-post'                  => 'Saudi Post',
				'dpd-ireland'                 => 'DPD Ireland',
				'Dpd-ireland'                 => 'DPD IE',
				'austrian-post-registered'    => 'Austrian Post (Registered)',
				'Austrian-post-registered'    => 'Austrian Post',
				'kerry-logistics'             => 'Kerry Express Thailand',
				'posten-norge'                => 'Posten Norge / Bring',
				'thailand-post'               => 'Thailand Thai Post',
				'hong-kong-post'              => 'Hong Kong Post',
				'portugal-seur'               => 'Portugal Seur',
				'international-seur'          => 'International Seur',
				'yrc'                         => 'YRC',
				'canada-post'                 => 'Canada Post',
				'aramex'                      => 'Aramex',
				'gati-kwe'                    => 'Gati-KWE',
				'dhl-global-mail-asia'        => 'DHL eCommerce Asia',
				'dhl-poland'                  => 'DHL Poland Domestic',
				'asendia-usa'                 => 'Asendia USA',
				'envialia'                    => 'Envialia',
				'magyar-posta'                => 'Magyar Posta',
				'nova-poshta'                 => 'Nova Poshta',
				'cambodia-post'               => 'Cambodia Post',
				'xend'                        => 'Xend Express',
				'2go'                         => '2GO',
				'chronopost-france'           => 'Chronopost France',
				'sgt-it'                      => 'SGT Corriere Espresso',
				'globegistics'                => 'Globegistics Inc.',
				'dachser'                     => 'DACHSER',
				'nightline'                   => 'Nightline',
				'tnt-au'                      => 'TNT Australia',
				'acscourier'                  => 'ACS Courier',
				'uk-mail'                     => 'UK Mail',
				'siodemka'                    => 'Siodemka',
				'kn'                          => 'Kuehne + Nagel',
				'safexpress'                  => 'Safexpress',
				'skynet'                      => 'SkyNet Malaysia',
				'nipost'                      => 'NiPost',
				'oca-ar'                      => 'OCA Argentina',
				'aeroflash'                   => 'Mexico AeroFlash',
				'dhl-global-mail'             => 'DHL eCommerce US',
				'sapo'                        => 'South African Post Office',
				'taqbin-hk'                   => 'TAQBIN Hong Kong',
				'deltec-courier'              => 'Deltec Courier',
				'mexico-senda-express'        => 'Mexico Senda Express',
				'mexico-redpack'              => 'Mexico Redpack',
				'japan-post'                  => 'Japan Post',
				'sagawa'                      => 'Sagawa',
				'viettelpost'                 => 'ViettelPost',
				'postnl-3s'                   => 'PostNL International 3S',
				'tiki'                        => 'Tiki',
				'opek'                        => 'FedEx Poland Domestic',
				'ceska-posta'                 => 'Česká Pošta',
				'geodis-calberson-fr'         => 'GEODIS - Distribution & Express',
				'ppbyb'                       => 'PayPal Package',
				'taqbin-jp'                   => 'Yamato Japan',
				'apc'                         => 'APC Postal Logistics',
				'ups-mi'                      => 'UPS Mail Innovations',
				'professional-couriers'       => 'Professional Couriers',
				'gojavas'                     => 'GoJavas',
				'cj-gls'                      => 'CJ GLS',
				'ups-freight'                 => 'UPS Freight',
				'singapore-speedpost'         => 'Singapore Speedpost',
				'taiwan-post'                 => 'Taiwan Post',
				'nacex-spain'                 => 'NACEX Spain',
				'lasership'                   => 'LaserShip',
				'china-ems'                   => 'China EMS (ePacket)',
				'China-ems'                   => 'China EMS( ePacket )',
				'CHina-ems'                   => 'Aliexpress Standard Shipping',
				'taqbin-sg'                   => 'TAQBIN Singapore',
				'bgpost'                      => 'Bulgarian Posts',
				'brazil-correios'             => 'Brazil Correios',
				'fedex'                       => 'FedEx',
				'ukrposhta'                   => 'UkrPoshta',
				'jam-express'                 => 'Jam Express',
				'estes'                       => 'Estes',
				'dtdc'                        => 'DTDC India',
				'Dtdc'                        => 'DTDC IN',
				'interlink-express'           => 'DPD Local',
				'austrian-post'               => 'Austrian Post (Express)',
				'star-track'                  => 'StarTrack',
				'first-logistics'             => 'First Logistics',
				'postnord'                    => 'PostNord Logistics',
				'belpost'                     => 'Belpost',
				'cyprus-post'                 => 'Cyprus Post',
				'spanish-seur'                => 'Spanish Seur',
				'air21'                       => 'AIR21',
				'lbcexpress'                  => 'LBC Express',
				'vnpost'                      => 'Vietnam Post',
				'rl-carriers'                 => 'RL Carriers',
				'sf-express'                  => 'S.F. Express',
				'Sf-express'                  => 'S.F Express',
				'lietuvos-pastas'             => 'Lietuvos Paštas',
				'ec-firstclass'               => 'EC-Firstclass',
				'an-post'                     => 'An Post',
				'usps'                        => 'USPS',
				'swiss-post'                  => 'Swiss Post',
				'india-post'                  => 'India Post Domestic',
				'aupost-china'                => 'AuPost China',
				'danmark-post'                => 'PostNord Denmark',
				'Danmark-post'                => 'Denmark Post',
				'gls-netherlands'             => 'GLS Netherlands',
				'dpd-uk'                      => 'DPD UK',
				'hrvatska-posta'              => 'Hrvatska Pošta',
				'posta-romana'                => 'Poșta Română',
				'courierpost'                 => 'CourierPost',
				'gdex'                        => 'GDEX',
				'singapore-post'              => 'Singapore Post',
				'tnt-fr'                      => 'TNT France',
				'fastway-au'                  => 'Fastway Australia',
				'new-zealand-post'            => 'New Zealand Post',
				'poste-italiane-paccocelere'  => 'Poste Italiane Paccocelere',
				'poste-italiane'              => 'Poste Italiane',
				'hermes-de'                   => 'Hermes Germany',
				'wahana'                      => 'Wahana',
				'dynamic-logistics'           => 'Dynamic Logistics',
				'dx'                          => 'DX',
				'taqbin-my'                   => 'TAQBIN Malaysia',
				'dhl'                         => 'DHL Express',
				'citylinkexpress'             => 'City-Link Express',
				'wedo'                        => 'WeDo Logistics',
				'malaysia-post-posdaftar'     => 'Malaysia Post - Registered',
				'Malaysia-post-posdaftar'     => 'Malaysia Post',
				'pos-indonesia'               => 'Pos Indonesia Domestic',
				'pos-indonesia-int'           => 'Pos Indonesia International',
				'xdp-uk'                      => 'XDP Express',
				'portugal-ctt'                => 'Portugal CTT',
				'Portugal-ctt'                => 'Portugal Post - CTT',
				'hermes'                      => 'Hermesworld',
				'fastway-ireland'             => 'Fastway Ireland',
				'raf'                         => 'RAF Philippines',
				'yundaex'                     => 'Yunda Express',
				'delhivery'                   => 'Delhivery',
				'dpe-za'                      => 'DPE South Africa',
				'equick-cn'                   => 'Equick China',
				'ecom-express'                => 'Ecom Express',
				'tnt-click'                   => 'TNT-Click Italy',
				'4px'                         => '4PX',
				'jcex'                        => 'JCEX',
				'post56'                      => 'Post56',
				'dhl-es'                      => 'DHL Spain Domestic',
				'transmission-nl'             => 'TransMission',
				'la-poste-colissimo'          => 'La Poste',
				'gls-italy'                   => 'GLS Italy',
				'Gls-italy'                   => 'GLS IT',
				'malaysia-post'               => 'Malaysia Post EMS / Pos Laju',
				'sto'                         => 'STO Express',
				'elta-courier'                => 'ELTA Hellenic Post',
				'postnl-international'        => 'PostNL International',
				'Postnl-international'        => 'Netherlands Post( PostNL )',
				'toll-ipec'                   => 'Toll IPEC',
				'asendia-de'                  => 'Asendia Germany',
				'correosexpress'              => 'Correos Express',
				'ecargo-asia'                 => 'Ecargo',
				'fercam'                      => 'FERCAM Logistics & Transport',
				'dawnwing'                    => 'Dawn Wing',
				'jayonexpress'                => 'Jayon Express (JEX)',
				'apc-overnight'               => 'APC Overnight',
				'bert-fr'                     => 'Bert Transport',
				'tuffnells'                   => 'Tuffnells Parcels Express',
				'ninjavan'                    => 'Ninja Van',
				'airpak-express'              => 'Airpak Express',
				'imxmail'                     => 'IMX Mail',
				'norsk-global'                => 'Norsk Global',
				'parcelpost-sg'               => 'Parcel Post Singapore',
				'gofly'                       => 'GoFly',
				'empsexpress'                 => 'EMPS Express',
				'detrack'                     => 'Detrack',
				'old-dominion'                => 'Old Dominion Freight Line',
				'airspeed'                    => 'Airspeed International Corporation',
				'jne'                         => 'JNE',
				'pandulogistics'              => 'Pandu Logistics',
				'mondialrelay'                => 'Mondial Relay',
				'lion-parcel'                 => 'Lion Parcel',
				'ups'                         => 'UPS',
				'Ups'                         => 'UPS DE',
				'australia-post'              => 'Australia Post',
				'Australia-post'              => 'Australia EMS',
				'dhl-nl'                      => 'DHL Netherlands',
				'israel-post-domestic'        => 'Israel Post Domestic',
				'skynetworldwide'             => 'SkyNet Worldwide Express',
				'tnt'                         => 'TNT',
				'royal-mail'                  => 'Royal Mail',
				'parcel-force'                => 'Parcel Force',
				'abf'                         => 'ABF Freight',
				'Abf'                         => 'ABF',
				'dhlparcel-nl'                => 'DHL Parcel NL',
				'greyhound'                   => 'Greyhound',
				'dhl-germany'                 => 'Deutsche Post DHL',
				'gls'                         => 'GLS',
				'i-parcel'                    => 'i-parcel',
				'colissimo'                   => 'Colissimo',
				'poczta-polska'               => 'Poczta Polska',
				'bpost-international'         => 'Bpost international',
				'taxydromiki'                 => 'Geniki Taxydromiki',
				'skynetworldwide-uk'          => 'Skynet Worldwide Express UK',
				'rpxonline'                   => 'RPX Online',
				'17postservice'               => '17 Post Service',
				'ghn'                         => 'Giao hàng nhanh',
				'israel-post'                 => 'Israel Post',
				'yodel'                       => 'Yodel Domestic',
				'trakpak'                     => 'TrakPak',
				'redur-es'                    => 'Redur Spain',
				'bluedart'                    => 'Bluedart',
				'emirates-post'               => 'Emirates Post',
				'szdpex'                      => 'DPEX China',
				'qxpress'                     => 'Qxpress',
				'courier-plus'                => 'Courier Plus',
				'800bestex'                   => 'Best Express',
				'courierit'                   => 'Courier IT',
				'dhl-deliverit'               => 'DHL 2-Mann-Handling',
				'dbschenker-se'               => 'DB Schenker',
				'xpressbees'                  => 'XpressBees',
				'dotzot'                      => 'Dotzot',
				'korea-post'                  => 'Korea Post EMS',
				'yodel-international'         => 'Yodel International',
				'mypostonline'                => 'Mypostonline',
				'panther'                     => 'Panther',
				'collectplus'                 => 'Collect+',
				'tntpost-it'                  => 'Nexive (TNT Post Italy)',
				'boxc'                        => 'BoxC',
				'deutsch-post'                => 'Deutsche Post Mail',
				'Deutsch-post'                => 'Deutsche Post',
				'first-flight'                => 'First Flight Couriers',
				'asm'                         => 'ASM',
				'brt-it'                      => 'BRT Bartolini',
				'colis-prive'                 => 'Colis Privé',
				'estafeta'                    => 'Estafeta',
				'dhl-benelux'                 => 'DHL Benelux',
				'mrw-spain'                   => 'MRW',
				'toll-priority'               => 'Toll Priority',
				'tnt-it'                      => 'TNT Italy',
				'Tnt-it'                      => 'TNT IT',
				'tnt-uk'                      => 'TNT UK',
				'arrowxl'                     => 'Arrow XL',
				'Arrowxl'                     => 'ArrowXL',
				'tgx'                         => 'Kerry Express Hong Kong',
				'ontrac'                      => 'OnTrac',
				'star-track-express'          => 'Star Track Express',
				'fedex-uk'                    => 'FedEx UK',
				'exapaq'                      => 'DPD France',
				'wishpost'                    => 'WishPost',
				'sic-teliway'                 => 'Teliway SIC Express',
				'packlink'                    => 'Packlink',
				'sweden-posten'               => 'PostNord Sweden',
				'canpar'                      => 'Canpar Courier',
				'myhermes-uk'                 => 'myHermes UK',
				'ramgroup-za'                 => 'RAM',
				'dhl-pieceid'                 => 'DHL Express (Piece ID)',
				'speedexcourier'              => 'Speedex Courier',
				'speedcouriers-gr'            => 'Speed Couriers',
				'dpd'                         => 'DPD',
				'Dpd'                         => 'DPD DE',
				'DPd'                         => 'DPD Austria',
				'dmm-network'                 => 'DMM Network',
				'vnpost-ems'                  => 'Vietnam Post EMS',
				'dsv'                         => 'DSV',
				'sfb2c'                       => 'S.F International',
				'russian-post'                => 'Russian Post',
				'flytexpress'                 => 'Flyt Express',
				'abxexpress-my'               => 'ABX Express',
				'kangaroo-my'                 => 'Kangaroo Worldwide Express',
				'yanwen'                      => 'Yanwen',
				'posti'                       => 'Posti',
				'cnexps'                      => 'CNE Express',
				'zjs-express'                 => 'ZJS International',
				'asendia-uk'                  => 'Asendia UK',
				'cbl-logistica'               => 'CBL Logistics',
				'correos-chile'               => 'Correos Chile',
				'dpd-poland'                  => 'DPD Poland',
				'newgistics'                  => 'Newgistics',
				'easy-mail'                   => 'Easy Mail',
				'fastrak-th'                  => 'Fastrak Services',
				'fastway-nz'                  => 'Fastway New Zealand',
				'Fastway-nz'                  => 'Fastway NZ',
				'nanjingwoyuan'               => 'Nanjing Woyuan',
				'lwe-hk'                      => 'Logistic Worldwide Express',
				'yunexpress'                  => 'Yun Express',
				'ubi-logistics'               => 'UBI Smart Parcel',
				'purolator'                   => 'Purolator',
				'bondscouriers'               => 'Bonds Couriers',
				'nationwide-my'               => 'Nationwide Express',
				'jet-ship'                    => 'Jet-Ship Worldwide',
				'rpx'                         => 'RPX Indonesia',
				'nhans-solutions'             => 'Nhans Solutions',
				'cuckooexpress'               => 'Cuckoo Express',
				'bh-posta'                    => 'JP BH Pošta',
				'rzyexpress'                  => 'RZY Express',
				'rrdonnelley'                 => 'RRD International Logistics U.S.A',
				'post-serbia'                 => 'Post Serbia',
				'costmeticsnow'               => 'Cosmetics Now',
				'correos-de-mexico'           => 'Correos de Mexico',
				'fedex-freight'               => 'FedEx Freight',
				'quantium'                    => 'Quantium',
				'tnt-reference'               => 'TNT Reference',
				'tnt-uk-reference'            => 'TNT UK Reference',
				'xdp-uk-reference'            => 'XDP Express Reference',
				'4-72'                        => '4-72 Entregando',
				'dpex'                        => 'DPEX',
				'dpd-de'                      => 'DPD Germany',
				'oneworldexpress'             => 'One World Express',
				'delcart-in'                  => 'Delcart',
				'sekologistics'               => 'SEKO Logistics',
				'kerryttc-vn'                 => 'Kerry Express (Vietnam) Co Ltd',
				'postur-is'                   => 'Iceland Post',
				'ninjavan-my'                 => 'Ninja Van Malaysia',
				'hh-exp'                      => 'Hua Han Logistics',
				'srekorea'                    => 'SRE Korea',
				'parcelled-in'                => 'Parcelled.in',
				'couriers-please'             => 'Couriers Please',
				'adsone'                      => 'ADSOne',
				'smsa-express'                => 'SMSA Express',
				'inpost-paczkomaty'           => 'InPost Paczkomaty',
				'omniparcel'                  => 'Omni Parcel',
				'dhl-hk'                      => 'DHL Hong Kong',
				'kgmhub'                      => 'KGM Hub',
				'con-way'                     => 'Con-way Freight',
				'echo'                        => 'Echo',
				'matkahuolto'                 => 'Matkahuolto',
				'china-post'                  => 'China Post',
				'postnl'                      => 'PostNL Domestic',
				'Postnl'                      => 'Netherlands Post( PostNL )',
				'lao-post'                    => 'Lao Post',
				'raben-group'                 => 'Raben Group',
				'360lion'                     => '360 Lion Express',
				'pfcexpress'                  => 'PFC Express',
				'matdespatch'                 => 'Matdespatch',
				'rocketparcel'                => 'Rocket Parcel International',
				'raiderex'                    => 'RaidereX',
				'cpacket'                     => 'cPacket',
				'yto'                         => 'YTO Express',
				'adicional'                   => 'Adicional Logistics',
				'sfcservice'                  => 'SFC Service',
				'directfreight-au'            => 'Direct Freight Express',
				'skypostal'                   => 'Asendia HK – Premium Service (LATAM)',
				'xq-express'                  => 'XQ Express',
				'dpe-express'                 => 'DPE Express',
				'idexpress'                   => 'IDEX',
				'buylogic'                    => 'Buylogic',
				'courex'                      => 'Urbanfox',
				'scudex-express'              => 'Scudex Express',
				'b2ceurope'                   => 'B2C Europe',
				'expeditors'                  => 'Expeditors',
				'thecourierguy'               => 'The Courier Guy',
				'dtdc-au'                     => 'DTDC Australia',
				'ninjavan-id'                 => 'Ninja Van Indonesia',
				'imexglobalsolutions'         => 'IMEX Global Solutions',
				'alphafast'                   => 'alphaFAST',
				'landmark-global'             => 'Landmark Global',
				'roadbull'                    => 'Roadbull Logistics',
				'Roadbull'                    => 'Roadbull',
				'geodis-espace'               => 'Geodis E-space',
				'australia-post-sftp'         => 'Australia Post Sftp',
				'simplypost'                  => 'J & T Express Singapore',
				'dhl-global-forwarding'       => 'DHL Global Forwarding',
				'interlink-express-reference' => 'DPD Local reference',
				'jersey-post'                 => 'Jersey Post',
				'directlog'                   => 'Directlog',
				'jocom'                       => 'Jocom',
				'sendle'                      => 'Sendle',
				'ekart'                       => 'Ekart',
				'hunter-express'              => 'Hunter Express',
				'xl-express'                  => 'XL Express',
				'yakit'                       => 'Yakit',
				'zyllem'                      => 'Zyllem',
				'dhl-active-tracing'          => 'DHL Active Tracing',
				'eparcel-kr'                  => 'eParcel Korea',
				'dex-i'                       => 'DEX-I',
				'brt-it-parcelid'             => 'BRT Bartolini(Parcel ID)',
				'holisol'                     => 'Holisol',
				'sendit'                      => 'Sendit',
				'mailamericas'                => 'MailAmericas',
				'dx-freight'                  => 'DX Freight',
				'copa-courier'                => 'Copa Airlines Courier',
				'mara-xpress'                 => 'Mara Xpress',
				'mikropakket'                 => 'Mikropakket',
				'wndirect'                    => 'wnDirect',
				'kiala'                       => 'Kiala',
				'ruston'                      => 'Ruston',
				'wanbexpress'                 => 'WanbExpress',
				'cj-korea-thai'               => 'CJ Korea Express',
				'wise-express'                => 'Wise Express',
				'rpd2man'                     => 'RPD2man Deliveries',
				'acommerce'                   => 'aCommerce',
				'panther-reference'           => 'Panther Reference',
				'logwin-logistics'            => 'Logwin Logistics',
				'wiseloads'                   => 'Wiseloads',
				'rincos'                      => 'Rincos',
				'alliedexpress'               => 'Allied Express',
				'hermes-it'                   => 'Hermes Italy',
				'asendia-hk'                  => 'Asendia HK',
				'ninjavan-thai'               => 'Ninja Van Thailand',
				'eurodis'                     => 'Eurodis',
				'whistl'                      => 'Whistl',
				'abcustom'                    => 'AB Custom Group',
				'tipsa'                       => 'TIPSA',
				'ninjavan-philippines'        => 'Ninja Van Philippines',
				'zto-express'                 => 'ZTO Express',
				'nim-express'                 => 'Nim Express',
				'alljoy'                      => 'ALLJOY SUPPLY CHAIN CO., LTD',
				'doora'                       => 'Doora Logistics',
				'collivery'                   => 'MDS Collivery Pty (Ltd)',
				'gsi-express'                 => 'GSI EXPRESS',
				'rcl'                         => 'Red Carpet Logistics',
				'mxe'                         => 'MXE Express',
				'birdsystem'                  => 'BirdSystem',
				'paquetexpress'               => 'Paquetexpress',
				'line'                        => 'Line Clear Express & Logistics Sdn Bhd',
				'efs'                         => 'EFS (E-commerce Fulfillment Service)',
				'instant'                     => 'INSTANT (Tiong Nam Ebiz Express Sdn Bhd)',
				'kpost'                       => 'Korea Post',
				'collectco'                   => 'CollectCo',
				'ddexpress'                   => 'DD Express Courier',
				'smooth'                      => 'Smooth Couriers',
				'panther-order-number'        => 'Panther Order Number',
				'sailpost'                    => 'SAILPOST',
				'tcs'                         => 'TCS',
				'ezship'                      => 'EZship',
				'nova-poshtaint'              => 'Nova Poshta (International)',
				'skynetworldwide-uae'         => 'SkyNet Worldwide Express UAE',
				'demandship'                  => 'DemandShip',
				'pickup'                      => 'Pickupp',
				'mudita'                      => 'MUDITA',
				'mainfreight'                 => 'Mainfreight',
				'aprisaexpress'               => 'Aprisa Express',
				'shreetirupati'               => 'SHREE TIRUPATI COURIER SERVICES PVT. LTD.',
				'omniva'                      => 'Omniva',
				'acsworldwide'                => 'ACS Worldwide Express',
				'janco'                       => 'Janco Ecommerce',
				'dylt'                        => 'Daylight Transport, LLC',
				'capital'                     => 'Capital Transport',
				'uds'                         => 'United Delivery Service, Ltd',
				'zepto-express'               => 'ZeptoExpress',
				'skybox'                      => 'SKYBOX',
				'jinsung'                     => 'JINSUNG TRADING',
				'amazon-fba-us'               => 'Amazon FBA USA',
				'saia-freight'                => 'Saia LTL Freight',
				'star-track-courier'          => 'Star Track Courier',
				'dpd-ro'                      => 'DPD Romania',
				'Dpd-ro'                      => 'DPD RO',
				'sky-postal'                  => 'SkyPostal',
				'wepost'                      => 'WePost Logistics',
				'palexpress'                  => 'PAL Express Limited',
				'chitchats'                   => 'Chit Chats',
				'aduiepyle'                   => 'A Duie Pyle',
				'pilot-freight'               => 'Pilot Freight Services',
				'ecms'                        => 'ECMS International Logistics Co., Ltd.',
				'jx'                          => 'JX',
				'bestwayparcel'               => 'Best Way Parcel',
				'zinc'                        => 'Zinc',
				'etotal'                      => 'eTotal Solution Limited',
				'xpost'                       => 'Xpost.ph',
				'lonestar'                    => 'Lone Star Overnight',
				'm-xpress'                    => 'M Xpress Sdn Bhd',
				'newgisticsapi'               => 'Newgistics API',
				'gls-cz'                      => 'GLS Czech Republic',
				'cj-malaysia'                 => 'CJ Century',
				'bjshomedelivery-ftp'         => 'BJS Distribution, Storage & Couriers - FTP',
				'bneed'                       => 'Bneed',
				'cj-malaysia-international'   => 'CJ Century (International)',
				'dtdc-express'                => 'DTDC Express Global PTE LTD',
				'deliveryontime'              => 'DELIVERYONTIME LOGISTICS PVT LTD',
				'k1-express'                  => 'K1 Express',
				'alfatrex'                    => 'AlfaTrex',
				'parcelpoint'                 => 'ParcelPoint Pty Ltd',
				'ep-box'                      => 'EP-Box',
				'pickupp-sgp'                 => 'PICK UPP',
				'pickupp-mys'                 => 'PICK UPP',
				'dpd-ru'                      => 'DPD Russia',
				'j-net'                       => 'J-Net',
				'trans-kargo'                 => 'Trans Kargo Internasional',
				'lht-express'                 => 'LHT Express',
				'dpd-hk'                      => 'DPD HK',
				'clevy-links'                 => 'Clevy Links',
				'bluecare'                    => 'Bluecare Express Ltd',
				'chrobinson'                  => 'C.H. Robinson Worldwide, Inc.',
				'cjlogistics'                 => 'CJ Logistics International',
				'dbschenker-sv'               => 'DB Schenker Sweden',
				'post-slovenia'               => 'Post of Slovenia',
				'bluestar'                    => 'Blue Star',
				'megasave'                    => 'Megasave',
				'007ex'                       => '007EX',
				'pixsell'                     => 'PIXSELL LOGISTICS',
				'cloudwish-asia'              => 'Cloudwish Asia',
				'dhlparcel-es'                => 'DHL Parcel Spain',
				'cj-philippines'              => 'CJ Transnational Philippines',
				'shippit'                     => 'Shippit',
				'shopfans'                    => 'ShopfansRU LLC',
				'kronos'                      => 'Kronos Express',
				'pitney-bowes'                => 'Pitney Bowes',
				'shree-maruti'                => 'Shree Maruti Courier Services Pvt Ltd',
				'tophatterexpress'            => 'Tophatter Express',
				'celeritas'                   => 'Celeritas Transporte, S.L',
				'dimerco'                     => 'Dimerco Express Group',
				'skynet-za'                   => 'Skynet World Wide Express South Africa',
				'fedex-crossborder'           => 'Fedex Cross Border',
				'mailplus'                    => 'MailPlus',
				'spoton'                      => 'SPOTON Logistics Pvt Ltd',
				'tolos'                       => 'Tolos',
				'kwt'                         => 'Shenzhen Jinghuada Logistics Co., Ltd',
				'sap-express'                 => 'SAP EXPRESS',
				'sending'                     => 'Sending Transporte Urgente y Comunicacion, S.A.U',
				'sypost'                      => 'Sunyou Post',
				'qualitypost'                 => 'QualityPost',
				'intexpress'                  => 'Internet Express',
				'seino'                       => 'Seino',
				'jtexpress'                   => 'J&T EXPRESS MALAYSIA',
				'linkbridge'                  => 'Link Bridge(BeiJing)international logistics co.,ltd',
				'national-sameday'            => 'National Sameday',
				'shiptor'                     => 'Shiptor',
				'bh-worldwide'                => 'B&H Worldwide',
				'parcel2go'                   => 'Parcel2Go',
				'endeavour-delivery'          => 'Endeavour Delivery',
				'kerrytj'                     => 'Kerry TJ Logistics',
				'aaa-cooper'                  => 'AAA Cooper',
				'aersure'                     => 'Aersure',
				'mglobal'                     => 'PT MGLOBAL LOGISTICS INDONESIA',
				'watkins-shepard'             => 'Watkins Shepard',
				'ocs'                         => 'OCS ANA Group',
				'descartes'                   => 'Innovel',
				'champion-logistics'          => 'Champion Logistics',
				'usf-reddaway'                => 'USF Reddaway',
				'latvijas-pasts'              => 'Latvijas Pasts',
				'fedex-fims'                  => 'FedEx International MailService',
				'sefl'                        => 'Southeastern Freight Lines',
				'danske-fragt'                => 'Danske Fragtmænd',
				'gso'                         => 'GSO',
				'sf-express-webhook'          => 'SF Express (Webhook)',
				'efex'                        => 'eFEx (E-Commerce Fulfillment & Express)',
				'wmg'                         => 'WMG Delivery',
				'paack-webhook'               => 'Paack',
				'apc-overnight-connum'        => 'APC Overnight Consignment Number',
				'usps-webhook'                => 'USPS Informed Visibility - Webhook',
				'osm-worldwide'               => 'OSM Worldwide',
				'expeditors-api'              => 'Expeditors API',
				'seko-sftp'                   => 'SEKO Worldwide, LLC',
				'antron'                      => 'Antron Express',
				'pickupp-vnm'                 => 'Pickupp Vietnam',
				'janio'                       => 'Janio Asia',
				'brt-it-sender-ref'           => 'BRT Bartolini(Sender Reference)',
				'kurasi'                      => 'KURASI',
				'gls-spain'                   => 'GLS Spain',
				'total-express'               => 'Total Express',
				'newzealand-couriers'         => 'NEW ZEALAND COURIERS',
				'lotte'                       => 'Lotte Global Logistics',
				'fmx'                         => 'FMX',
				'knuk'                        => 'KNAirlink Aerospace Domestic Network',
				'hx-express'                  => 'HX Express',
				'shippify'                    => 'Shippify, Inc',
				'gls-croatia'                 => 'GLS Croatia',
				'dpd-fr-reference'            => 'DPD France',
				'dhl-supply-chain-au'         => 'DHL Supply Chain Australia',
				'always-express'              => 'Always Express',
				'australia-post-api'          => 'Australia Post API',
				'fetchr'                      => 'Fetchr',
				'inexpost'                    => 'Inexpost',
				'expresssale'                 => 'Expresssale',
				'hipshipper'                  => 'Hipshipper',
				'westbank-courier'            => 'West Bank Courier',
				'mailplus-jp'                 => 'MailPlus',
				'ky-express'                  => 'Kua Yue Express',
				'misumi-cn'                   => 'MISUMI Group Inc.',
				'cae-delivers'                => 'CAE Delivers',
				'dayton-freight'              => 'Dayton Freight',
				'pony-express'                => 'Pony express',
				'dajin'                       => 'Shanghai Aqrum Chemical Logistics Co.Ltd',
				'xpert-delivery'              => 'Xpert Delivery',
				'mainway'                     => 'Mainway',
				'amazon'                      => 'Amazon Ground',
				'gls-slovakia'                => 'GLS General Logistics Systems Slovakia s.r.o.',
				'aquiline'                    => 'Aquiline',
				'dao365'                      => 'DAO365',
				'urgent-cargus'               => 'Urgent Cargus',
				'lalamove'                    => 'Lalamove',
				'jne-api'                     => 'JNE',
				'gba'                         => 'GBA Services Ltd',
				'globaltranz'                 => 'GlobalTranz',
				'ao-courier'                  => 'AO Logistics',
				'general-overnight'           => 'Go!Express and logistics',
				'planzer'                     => 'Planzer Group',
				'naqel-express'               => 'Naqel Express',
				'parknparcel'                 => 'Park N Parcel',
				'i-dika'                      => 'i-dika',
				'dhl-global-mail-asia-api'    => 'DHL eCommerce Asia',
				'mx-cargo'                    => 'M&X cargo',
				'smg-express'                 => 'SMG Direct',
				'zeleris'                     => 'Zeleris',
				'virtransport'                => 'VIR Transport',
				'eu-fleet-solutions'          => 'EU Fleet Solutions',
				'tuffnells-reference'         => 'Tuffnells Parcels Express- Reference',
				'speedy'                      => 'Speedy',
				'neway'                       => 'Neway Transport',
				'ids-logistics'               => 'IDS Logistics',
				'landmark-global-reference'   => 'Landmark Global Reference',
				'pioneer-logistics'           => 'Pioneer Logistics Systems, Inc.',
				'apg'                         => 'APG eCommerce Solutions Ltd.',
				'delnext'                     => 'Delnext',
				'gls-slovenia'                => 'GLS Slovenia',
				'pittohio'                    => 'PITT OHIO',
				'cope'                        => 'Cope Sensitive Freight',
				'cjpacket'                    => 'CJ Packet',
				'pil-logistics'               => 'PIL Logistics (China) Co., Ltd',
				'milkman'                     => 'Milkman',
				'intel-valley'                => 'Intel-Valley Supply chain (ShenZhen) Co. Ltd',
				'fetchr-webhook'              => 'Mena 360 (Fetchr)',
				'logicmena'                   => 'Logic Mena',
				'speedee'                     => 'Spee-Dee Delivery',
				'carriers'                    => 'Carriers',
				'forrun'                      => 'forrun Pvt Ltd (Arpatech Venture)',
				'correosexpress-api'          => 'Correos Express',
				'eshipping'                   => 'Eshipping',
				'xpedigo'                     => 'Xpedigo',
				'spanish-seur-api'            => 'Spanish Seur API',
				'continental'                 => 'Continental',
				'fasttrack'                   => 'Fasttrack',
				'paper-express'               => 'Paper Express',
				'relaiscolis'                 => 'Relais Colis',
				'weaship'                     => 'Weaship',
				'sutton'                      => 'Sutton Transport',
				'dhl-supplychain-id'          => 'DHL Supply Chain Indonesia',
				'budbee-webhook'              => 'Budbee',
				'mazet'                       => 'Groupe Mazet',
				'liefery'                     => 'liefery',
				'legion-express'              => 'Legion Express',
				'wizmo'                       => 'Wizmo',
				'tourline'                    => 'tourline',
				'huodull'                     => 'Huodull',
				'sfplus-webhook'              => 'SF Plus',
				'doordash-webhook'            => 'DoorDash',
				'dhlparcel-uk'                => 'DHL Parcel UK',
				'Dhlparcel-uk'                => 'DHL UK',
				'hdb'                         => 'Haidaibao',
				'ceva'                        => 'CEVA LOGISTICS',
				'okayparcel'                  => 'OkayParcel',
				'ocs-worldwide'               => 'OCS WORLDWIDE',
				'up-express'                  => 'UP-express',
				'amazon-logistics-uk'         => 'Amazon Logistics',
				'toll-nz'                     => 'Toll New Zealand',
				'box-berry'                   => 'Boxberry',
				'loomis-express'              => 'Loomis Express',
				'ets-express'                 => 'RETS express',
				'cbl-logistica-api'           => 'CBL Logistica',
				'dnj-express'                 => 'DNJ Express',
				'dms-matrix'                  => 'DMSMatrix',
				'logistyx-transgroup'         => 'Transgroup',
				'cdek-tr'                     => 'CDEK TR',
				'nowlog-api'                  => 'NOWLOG LOGISTICA INTELIGENTE LTD',
				'2ebox'                       => '2ebox',
				'freterapido'                 => 'Frete Rápido',
				'carry-flap'                  => 'Carry-Flap Co.,Ltd.',
				'hdb-box'                     => 'Haidaibao',
				'cfl-logistics'               => 'CFL Logistics',
				'xpo-logistics'               => 'XPO logistics',
				'gemworldwide'                => 'GEM Worldwide',
				'fitzmark-api'                => 'FitzMark',
				'mail-box-etc'                => 'Mail Boxes Etc.',
				'bond'                        => 'Bond',
				'firstmile'                   => 'FirstMile',
				'bring'                       => 'Bring',
				'tck-express'                 => 'TCK Express',
				'cubyn'                       => 'Cubyn',
				'ecoutier'                    => 'eCoutier',
				'sk-posta'                    => 'Slovenská pošta, a.s.',
				'allied-express-ftp'          => 'Allied Express'
			);

			return $carriers;
		}

		/**
		 * @param $name
		 *
		 * @return bool|int|string
		 */
		public static function get_carrier_slug_by_name( $name ) {
			$carriers = self::carriers();

			return VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::array_search_case_insensitive( $name, $carriers );
		}

		/**
		 * @param $slug
		 *
		 * @return array
		 */
		public static function get_original_carrier_slug( $slug ) {
			$get_carriers = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_carriers();
			$carriers     = self::carriers();
			$names        = array_column( $get_carriers, 'name' );
			$return       = array();
			foreach ( $carriers as $key => $value ) {
				if ( strtolower( $key ) === $slug ) {
					$search = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::array_search_case_insensitive( $value, $names );
					if ( $search !== false ) {
						$return[] = $get_carriers[ $search ]['slug'];
					}
				}
			}

			return $return;
		}

		/**
		 * @param $trackings
		 * @param $carrier_id
		 * @param $service_carrier_type
		 * @param string $change_order_status
		 *
		 * @throws Exception
		 */
		public static function update_tracking_data( $trackings, $carrier_id, $service_carrier_type, $change_order_status = '' ) {
			foreach ( $trackings as $tracking ) {
				$tracking_number = $tracking['tracking_number'];
				$track_info      = self::get_track_info( $tracking['checkpoints'] );
				$last_event      = '';
				if ( $track_info ) {
					$last_event = $track_info[0]['description'];
					$track_info = vi_wot_json_encode( $track_info );
				} else {
					$track_info = '';
				}
				$status = $tracking['tag'];
				VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update_by_tracking_number( $tracking_number, $carrier_id, $service_carrier_type, $status, $track_info, $last_event, $tracking['expected_delivery'], $tracking['origin_country_iso3'], $tracking['destination_country_iso3'] );
				if ( $status ) {
					VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ORDERS_TRACK_INFO::update_order_items_tracking_status( $tracking_number, $carrier_id, $status, $change_order_status );
				}
			}
		}

		public static function map_statuses( $status = '' ) {
			$statuses = apply_filters( 'wot_aftership_shipment_statuses_mapping', array(
				'inforeceived'         => 'pending',
				'pending'              => 'pending',
				'intransit'            => 'transit',
				'available_for_pickup' => 'pickup',
				'outfordelivery'       => 'pickup',
				'failedattempt'        => 'alert',
				'exception'            => 'alert',
				'expired'              => 'alert',
				'delivered'            => 'delivered',
			) );
			if ( $status ) {
				return isset( $statuses[ $status ] ) ? $statuses[ $status ] : '';
			} else {
				return $statuses;
			}
		}

		public static function status_text() {
			return apply_filters( 'wot_aftership_all_shipment_statuses', array(
				'inforeceived'         => esc_html_x( 'Info Received', 'aftership_tracking_status', 'woocommerce-orders-tracking' ),
				'pending'              => esc_html_x( 'Pending', 'aftership_tracking_status', 'woocommerce-orders-tracking' ),
				'intransit'            => esc_html_x( 'Intransit', 'aftership_tracking_status', 'woocommerce-orders-tracking' ),
				'available_for_pickup' => esc_html_x( 'Available For Pickup', 'aftership_tracking_status', 'woocommerce-orders-tracking' ),
				'outfordelivery'       => esc_html_x( 'Out For Delivery', 'aftership_tracking_status', 'woocommerce-orders-tracking' ),
				'failedattempt'        => esc_html_x( 'Failed Attempt', 'aftership_tracking_status', 'woocommerce-orders-tracking' ),
				'exception'            => esc_html_x( 'Exception', 'aftership_tracking_status', 'woocommerce-orders-tracking' ),
				'expired'              => esc_html_x( 'Expired', 'aftership_tracking_status', 'woocommerce-orders-tracking' ),
				'delivered'            => esc_html_x( 'Delivered', 'aftership_tracking_status', 'woocommerce-orders-tracking' ),
			) );
		}

		public static function get_status_text( $status ) {
			$statuses = self::status_text();

			return isset( $statuses[ $status ] ) ? $statuses[ $status ] : '';
		}
	}
}
