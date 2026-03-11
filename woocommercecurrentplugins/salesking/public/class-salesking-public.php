<?php

class Salesking_Public{

	function __construct() {


		add_action('plugins_loaded', function(){

			// Only load if WooCommerce is activated
			if ( class_exists( 'woocommerce' ) ) {		

				// Add classes to body
				add_filter('body_class', array( $this, 'salesking_body_classes' ));

				// Load dashboard as full screen by removing templates
				add_filter( 'woocommerce_locate_template', array( $this, 'salesking_locate_template' ), 99999, 3 );
				add_filter( 'template_include', array( $this, 'salesking_template_include' ), 99999, 1 );

				// Page query var for dashboard
				add_filter( 'query_vars', array($this, 'salesking_add_query_vars_filter') );
				add_action( 'init', array($this, 'salesking_rewrite_dashboard_url' ));
				add_action( 'wp', array($this, 'salesking_ensure_affiliate_urls_parsed' ));
				add_action( 'wp_footer', array($this, 'salesking_ensure_affiliate_urls_parsed' ));

				// Registration assign agent
				add_action( 'woocommerce_register_form', array($this,'salesking_registration_link'), 11 );
				add_action( 'woocommerce_after_checkout_registration_form', array($this,'salesking_registration_link') );

				add_action( 'woocommerce_created_customer', array($this,'salesking_assign_agent_registration') );
				add_action( 'user_register', array($this,'salesking_assign_agent_registration') );
				add_action( 'register_new_user', array($this,'salesking_assign_agent_registration') );
				// throw registration error if invalid rep ID
				add_filter( 'woocommerce_process_registration_errors', array($this,'salesking_check_registration_errors'), 10, 3 );
			
				// Prevent agent from editing user based on setting
				if (intval(get_option( 'salesking_agents_can_edit_customers_setting', 1 )) !== 1){
					// if edit not enabled
					add_action('template_redirect', array($this, 'salesking_prevent_edit_details'));
				}

				// Redirect after cart is added by customer via link + populate cart and set cookies
				add_action('template_redirect', array($this, 'salesking_cart_link_add'));

				// check if current user has been switched to from
				add_action('wp_footer', array($this, 'salesking_switched_to'));

				// Enqueue resources
				add_action('wp_enqueue_scripts', array($this, 'enqueue_public_resources'));

				// Add Private Sales Agent Order Notes box
				add_filter( 'woocommerce_checkout_fields' , array($this, 'salesking_private_sales_agent_notes') );
				// save note
				add_action( 'woocommerce_checkout_update_order_meta', array( $this, 'salesking_save_private_note') );

				// if one of the settings for edit prices is enabled, allow prices to be edited in cart
				if (intval(get_option( 'salesking_agents_can_edit_prices_increase_setting', 1 )) === 1 || intval(get_option( 'salesking_agents_can_edit_prices_discounts_setting', 1 )) === 1){
					// if this is an agent 
					add_filter( 'woocommerce_cart_item_price', array( $this, 'set_price_in_cart' ), 999999, 3 );

					add_action( 'woocommerce_before_mini_cart', function(){
						remove_filter( 'woocommerce_cart_item_price', array( $this, 'set_price_in_cart' ), 999999, 3 );
					}, 999, 0);
					add_action( 'woocommerce_after_mini_cart', function(){
						add_filter( 'woocommerce_cart_item_price', array( $this, 'set_price_in_cart' ), 999999, 3 );
					}, 999, 0);

					add_filter( 'woocommerce_product_get_price', array( $this, 'retrieve_prices' ), 999999, 2 );
					add_action( 'woocommerce_before_calculate_totals', array( $this, 'calculate_prices' ), 999999 );
					add_action ('woocommerce_new_order_item', array( $this, 'add_prices_to_order' ), 999999, 2 );
					
				}

				// if user is agent, add button in my account page to agent dashboard
				add_action('woocommerce_account_dashboard', array($this, 'salesking_dashboard_button'), 10);

				// Register post types in frontend
				require_once ( SALESKING_DIR . 'admin/class-salesking-admin.php' );
				add_action( 'init', array('Salesking_Admin', 'salesking_register_post_type_announcement'), 0 );
				add_action( 'init', array('Salesking_Admin', 'salesking_register_post_type_message'), 0 );
				add_action( 'init', array('Salesking_Admin', 'salesking_register_post_type_agent_groups'), 0 );
				add_action( 'init', array('Salesking_Admin', 'salesking_register_post_type_earning'), 0 );

				/* Earnings and Calculations */
				// Register Order, Calculate Earnings

				add_action( 'woocommerce_checkout_order_processed', array($this,'salesking_register_order_calculate_earnings'), 10000, 3);
				add_action( 'woocommerce_blocks_checkout_order_processed', array($this,'salesking_register_order_calculate_earnings'), 10000, 3);
				add_action( 'woocommerce_renewal_order_created', array($this,'salesking_register_order_calculate_earnings'), 10000, 3);
				add_action( 'wcs_renewal_order_created', array($this,'salesking_register_order_calculate_earnings'), 10000, 3);

				add_action( 'marketking_order_split_created', array($this,'salesking_register_order_calculate_earnings'), 10000, 3);
				// calculateion integrations

				// WEPOS
				add_action( 'woocommerce_order_status_completed', array($this, 'salesking_calculate_integrations'), 100, 2);
				// VITPEOS
				add_action( 'vitepos/action/send-customer-email', array($this, 'salesking_calculate_integrations'), 100, 2);

				


				// Limit levels for subagents
				add_filter('option_salesking_enable_teams_setting', [$this,'salesking_limit_subagents_levels'], 10, 1);

				// affid home redirect
				add_action('salesking_redirect_after_set_cookie', [$this, 'affid_home_redirect']);

				// Apply monthly group rules
				add_action( 'init', [$this, 'monthly_group_rules']);


			}
		});
	}

	function salesking_calculate_integrations($order_id, $order = 0){

		if ($order === 0){
			$order = wc_get_order($order_id);
		}

		$created_via = $order->get_created_via();
		if ($created_via === 'wepos'){
			// calculate SK here
			$this->salesking_register_order_calculate_earnings($order_id);
		} else {
			// vitepos check
			if (get_post_meta($order_id, '_is_vitepos', true) == 'Y'){
				$this->salesking_register_order_calculate_earnings($order_id);
			}
		}
	}

	function affid_home_redirect(){
		if (is_home()){
		    if (isset($_GET['affid'])){
		        wp_redirect(get_home_url());
		    }
		}
	}

	function salesking_limit_subagents_levels($enabled){

		$levels = intval(get_option('salesking_enable_teams_levels_setting',0));

		if ($levels !== 0){ // if levels = 0, it means unlimited

			// check how far down current user is (how many parents)
			$user_id = get_current_user_id();
			$current_id = $user_id;
			$parents = 0;

			while (!empty(get_user_meta($current_id,'salesking_parent_agent', true))){
				$current_id = get_user_meta($current_id,'salesking_parent_agent', true);
				$parents++;
			}

			if ($parents >= $levels){
				// disable subagent capability
				$enabled = 0;
			}

		}

		return $enabled;
	}

	function salesking_dashboard_button(){
		if ($this->is_agent(get_current_user_id())){
			?>
			<a class="salesking_go_to_agent_dashboard" href="<?php echo esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true))));?>"><button class="salesking_go_to_agent_dashboard_button"><?php esc_html_e('Go to Sales Agent Dashboard', 'salesking'); ?></button></a>
			<?php
		}
	}

	// Add user classes to body
	function salesking_body_classes($classes) {
		// if user is agent
		$user_id = get_current_user_id();

		$agent_group = get_user_meta($user_id,'salesking_group',true);
		if ($agent_group !== 'none' && !empty($agent_group)){
			$classes[] = 'salesking_agent';
			$classes[] = 'salesking_agent_group_'.$agent_group;
		} else {
			$classes[] = 'salesking_not_agent';
		} 

		// shop as customer clas
		if ($this->check_user_is_agent_with_access()){
			$classes[] = 'salesking_shopping_as_customer';
		} else {
			$classes[] = 'salesking_not_shopping_as_customer';
		}
	    
	    return $classes;
	}

	public function salesking_register_order_calculate_earnings($order_id, $posted_data = array(), $order = array()){

		require_once ( SALESKING_DIR . 'includes/class-salesking-helper.php' );
		$helper = new Salesking_Helper();

		// check order post type / compatibility with plugins
		$type = get_post_type($order_id);
		if ($type !== 'shop_order'){
			$order = wc_get_order($order_id);
			if (!$order){
				$order_id = intval($order_id)-1;
			}
		}

		// if subscription, assign same agent
		if (class_exists('WC_Subscriptions')) {
			// Check if this order is related to a subscription
		    $subscriptions = wcs_get_subscriptions_for_order($order_id, array('order_type' => array('parent', 'renewal')));
		    
		    if (!empty($subscriptions)) {
		        foreach ($subscriptions as $subscription) {
		            // Get the agent assigned to the subscription
		            $subscription_agent = $subscription->get_meta('salesking_assigned_agent');
		            
		            // If subscription has an agent assigned
		            if (!empty($subscription_agent)) {
		                // Set the same agent for the order
		                if (is_object($order)){
			                $order->update_meta_data('salesking_assigned_agent', $subscription_agent);
			                $order->save();
			            }
		                break;
		            }
		        }
		    }
		}

		if (!is_array($posted_data)){
			return;
		}

		if ( isset($posted_data['recalculate'])){
			$recalculate = true;
		} else {
			$recalculate = false;
		}

		// sanity
		// if order already has an earning, then clearly the earnings have been calculated
		$order = wc_get_order($order_id);
		if ($order){

			$earning_id_check = $order->get_meta('salesking_earning_id');
			if (!empty($earning_id_check)){
				if ( ! $recalculate){
					$order->update_meta_data('_salesking_calculated_earnings', 'yes');
					$order->save();
				}
			}
		}

		// for marketking multivendor orders, skip, because we calculate for each order
		if (defined('MARKETKINGCORE_DIR')){
			if (marketking()->is_multivendor_order($order_id)){
				$order->update_meta_data('_salesking_calculated_earnings', 'yes');
				$order->save();
			}
		}

		// check it has not already been calculated
		if ($order->get_meta('_salesking_calculated_earnings') !== 'yes' || $recalculate){

			// Determine if this order should be assigned to any agent, by checking all assignment possibilities
			/*
			5 possibilities:
			- customer is assigned to agent and places order
			- a user places an order and uses agent coupon
			- agent uses shop as customer to place order on behalf of customer, customer only pays it
			- cart sharing:
			same as coupons, user gets assigned to agent + order appears as placed by customer
			- customer shops with affiliate cookie
			*/
			if ($order){
				
				$order->update_meta_data('_salesking_calculated_earnings', 'yes');
				$order->save();

				$assign_customer_to_agent = true; // assign the customer to the agent found, or not


				// STEP 1: we find the assigned agent for this order
				$order_assigned_agent = 0;
				$customer_id = $order->get_customer_id();

				// first check if any agent is selected directly (E.g. during checkout)
		    	if (isset($_POST['salesking_registration_link'])){
		    		$registration_value = sanitize_text_field($_POST['salesking_registration_link']);
		    		if (!empty($registration_value)){
		    			// get agent user ID
		    			$agent = get_users(array(
						    'meta_key'     => 'salesking_agentid',
						    'meta_value'   => $registration_value,
						    'meta_compare' => '=',
						    'fields' => 'ids',
						));
						if (count($agent) === 1 || $registration_value === 'none'){
							$order_assigned_agent = $agent[0];
						}
		    		}
		    	}


				// if all agents can shop for all customers, then customer's assigned agent no longer takes priority
				if (intval(get_option( 'salesking_all_agents_shop_all_customers_setting', 0 )) === 0 || ! apply_filters('salesking_agent_shop_customer_use_commission', true)){
					// CUSTOMER ALREADY ASSIGNED
					$customer_agent = get_user_meta($customer_id,'salesking_assigned_agent', true);
					if (!empty($customer_agent)){
						if ($this->is_agent($customer_agent)){
							$order_assigned_agent = $customer_agent;
						}
					}
					if ($order_assigned_agent === 0){
						$customer_agent = get_user_meta($customer_id,'salesking_agent', true);
						if (!empty($customer_agent)){
							if ($this->is_agent($customer_agent)){
								$order_assigned_agent = $customer_agent;
							}
						}
					}

					if (defined('B2BKING_DIR') || defined('B2BKINGCORE_DIR')){
						// Search customer group
						if ($order_assigned_agent === 0){
							$b2b_user = get_user_meta($customer_id,'b2bking_b2buser', true);
							if ($b2b_user === 'yes'){
								$b2b_group = get_user_meta($customer_id,'b2bking_customergroup', true);
								if (!empty($b2b_group)){
									$group_agent = get_post_meta($b2b_group,'salesking_assigned_agent', true);
									if (!empty($group_agent)){
										if ($this->is_agent($group_agent)){
											$order_assigned_agent = $group_agent;
										}
									}
								}
							}
						}
					}
				}


				// if the customer is an agent themselves
				if ($this->is_agent($customer_id)){

					// if agents earn commission on their own orders
					if (intval(get_option( 'salesking_agents_own_orders_commission_setting', 0 )) === 1){
						// assigned agent is self
						$order_assigned_agent = $customer_id;
					}
				}


				// COUPONS // if no agent yet, keep searching.
				if (apply_filters('salesking_commissions_use_coupons', true)){
					if ($order_assigned_agent === 0){
						foreach( $order->get_coupon_codes() as $coupon_code) {
					        $coupon_id = $this->get_coupon_id_by_code($coupon_code);
					        // check agent
					        $coupon_agent = get_post_meta($coupon_id,'salesking_agent', true);

					        if (!empty($coupon_agent)){

					        	if ($this->is_agent($coupon_agent)){
					        		$order_assigned_agent = $coupon_agent;
					        		$assign_customer_to_agent = apply_filters('salesking_assign_customer_to_agent_coupon', $assign_customer_to_agent, $coupon_agent, $order);
					        	}
					        }
					    }
					}
				}

			    // AGENT USED SHOP AS CUSTOMER // if no agent yet, keep searching.
			    if (apply_filters('salesking_commissions_use_shop_as_customer', true)){
				    if ($order_assigned_agent === 0){
				    	if ($this->check_user_is_agent_with_access()){
							$agent_id = $this->get_current_agent_id();
							$order_assigned_agent = $agent_id;
							$assign_customer_to_agent = apply_filters('salesking_assign_customer_to_agent_shopping_as_customer', $assign_customer_to_agent, $order);

						}
				    }
				}

			    // SEARCH CART SHARING COOKIE OR AFFILIATE COOKIE
			    if (apply_filters('salesking_commissions_use_cookies', true)){
				    if ($order_assigned_agent === 0){
				    	if (isset($_COOKIE['salesking_affiliate_cookie'])){
				    		$affiliate_cookie = sanitize_text_field($_COOKIE['salesking_affiliate_cookie']);
				    		// search agentid
			    			$agent = get_users(array(
							    'meta_key'     => 'salesking_agentid',
							    'meta_value'   => $affiliate_cookie,
							    'meta_compare' => '=',
							    'fields' => 'ids',
							));
							if (count($agent) === 1){
								$order_assigned_agent = $agent[0];
							}
				    	}
				    }	
				}

			    if ($order_assigned_agent === 0){
				    if (intval(get_option( 'salesking_all_agents_shop_all_customers_setting', 0 ))=== 1 && apply_filters('salesking_agent_shop_customer_use_commission', true)){
				    	// CUSTOMER ALREADY ASSIGNED
				    	$customer_id = $order->get_customer_id();
				    	$customer_agent = get_user_meta($customer_id,'salesking_assigned_agent', true);
				    	if (!empty($customer_agent)){
				    		if ($this->is_agent($customer_agent)){
				    			$order_assigned_agent = $customer_agent;
				    		}
				    	}
				    	if ($order_assigned_agent === 0){
				    		$customer_agent = get_user_meta($customer_id,'salesking_agent', true);
				    		if (!empty($customer_agent)){
				    			if ($this->is_agent($customer_agent)){
				    				$order_assigned_agent = $customer_agent;
				    			}
				    		}
				    	}

				    	if (defined('B2BKING_DIR') || defined('B2BKINGCORE_DIR')){
				    		// Search customer group
				    		if ($order_assigned_agent === 0){
				    			$b2b_user = get_user_meta($customer_id,'b2bking_b2buser', true);
				    			if ($b2b_user === 'yes'){
				    				$b2b_group = get_user_meta($customer_id,'b2bking_customergroup', true);
				    				if (!empty($b2b_group)){
				    					$group_agent = get_post_meta($b2b_group,'salesking_assigned_agent', true);
				    					if (!empty($group_agent)){
				    						if ($this->is_agent($group_agent)){
				    							$order_assigned_agent = $group_agent;
				    						}
				    					}
				    				}
				    			}
				    		}
				    	}
				    }	
				}

				if (isset($_POST['customer_user'])){
					if (intval($order_assigned_agent) === 0){
						$order_assigned_agent = $_POST['customer_user'];

						// check if this user has an agent, and if so, set the user's agent
						$customer_agent = get_user_meta($order_assigned_agent,'salesking_assigned_agent', true);
						if (!empty($customer_agent)){
							if (intval($customer_agent) !== 0){
								$order_assigned_agent = $customer_agent;
							}
						}
					}
				}

				$order_assigned_agent = apply_filters('salesking_agent_assigned_order', $order_assigned_agent, $order);

				// check, must be agent
				if (!$this->is_agent($order_assigned_agent)){
					$order_assigned_agent = 0;
				}

				if (intval($order_assigned_agent) === 0){
					if (isset($_POST['salesking_agent_order'])){
						$order_assigned_agent = sanitize_text_field($_POST['salesking_agent_order']);
					}
				}

			    // cancel function if this order does not have an agent
			    if ($order_assigned_agent !== 0 or intval(get_option( 'salesking_individual_agents_auto_commissions_setting', 0 )) === 1){

			    	// here let's have an option via FILTER to always set the assigned agent to 0 (so that individual agent rules are not affected by for example an agent giving a coupon or affilaite link)
			    	if (apply_filters('salesking_assigned_agent_order_never', false)){
			    		$order_assigned_agent = 0;
			    	}

			    	$agent_id = $order_assigned_agent;

				    // STEP 2: We check and set who placed the order
				    $placed_by = 0;
				    if ($this->check_user_is_agent_with_access()){
				    	$agent_id = $this->get_current_agent_id();
				    	if ($agent_id !== $order->get_customer_id()){
				    		$placed_by = 'placed_by_agent';
				    		$order->update_meta_data('salesking_order_placed_by', $agent_id);

				    	} else {
				    		$placed_by = 'placed_by_customer';
				    	}
				    } else {
				    	$placed_by = 'placed_by_customer';
				    }
				    $order->update_meta_data('salesking_order_placed_type', $placed_by);
				    $order->save();

				    // Step 3: Assign customer to agent if not already assigned + assign order to agent
				    // (only if we're not applying commission by product for individual agents)
				    if ($order_assigned_agent !== 0){

				    	if ($assign_customer_to_agent){
				    		if (apply_filters('salesking_assign_customer_to_agent', true)){
				    			update_user_meta($customer_id, 'salesking_assigned_agent', $order_assigned_agent);
				    		}
				    	}

				    	$order->update_meta_data('salesking_assigned_agent', $order_assigned_agent);
				    	// also assign subscription
				    	if (class_exists('WC_Subscriptions')) {
			    	        // Get subscriptions linked to this order
			    	        $subscriptions = wcs_get_subscriptions_for_order($order, array('order_type' => array('parent', 'renewal')));
			    	        
			    	        if (!empty($subscriptions)) {
			    	            foreach ($subscriptions as $subscription) {
			    	                // Update the subscription's agent
			    	                $subscription->update_meta_data('salesking_assigned_agent', $order_assigned_agent);
			    	                $subscription->save();
			    	            }
			    	        }
			    	    }


				    	$agent_obj = new WP_User($order_assigned_agent);
				    	$customer_obj = new WP_User($customer_id);

				    	$agent_name = $agent_obj->first_name.' '.$agent_obj->last_name;
				    	$customer_name = $customer_obj->first_name.' '.$customer_obj->last_name;

				    	if ($agent_name !== $customer_name){

				    		// order agent
				    		$order->update_meta_data('salesking_assigned_agent_name', $agent_name);

				    		// default customer agent
				    		$default_agent_name_id = get_user_meta($customer_id,'salesking_assigned_agent', true);
				    		$default_agent_obj = new WP_User($default_agent_name_id);
				    		$default_agent_name = $default_agent_obj->first_name.' '.$default_agent_obj->last_name;
				    		$order->update_meta_data('salesking_customer_assigned_agent_name', $default_agent_name);


				    		$agent_id_code = get_user_meta($order_assigned_agent, 'salesking_agentid', true);
				    		
				    		$order->update_meta_data('salesking_assigned_agent_code', $agent_id_code);


				    		do_action('salesking_assign_agent_code_order', $order_id, $order_assigned_agent);


				    	} else {
				    		$agent_name_id = get_user_meta($customer_id,'salesking_assigned_agent', true);
				    		$agent_obj = new WP_User($agent_name_id);
				    		$agent_name = $agent_obj->first_name.' '.$agent_obj->last_name;
				    		$order->update_meta_data('salesking_assigned_agent_name', $agent_name);


				    		$agent_id_code = get_user_meta($agent_name_id, 'salesking_agentid', true);
				    		$order->update_meta_data('salesking_assigned_agent_code', $agent_id_code);


				    		do_action('salesking_assign_agent_code_order', $order_id, $agent_name_id);
				    	}

				    	$order->save();

				    }

				    // sanity check, user cannot be his own agent
				    if (intval(get_option( 'salesking_agents_own_orders_commission_setting', 0 )) === 0){
				    	if (intval($order_assigned_agent) === get_current_user_id()){
					    	$order_assigned_agent = 0;
							$agent_id = 0;
					    }
						if (intval($order_assigned_agent) === $customer_id or intval($agent_id) === $customer_id){
					    	$order_assigned_agent = 0;
							$agent_id = 0;
					    }
				    }
				    
				    if (empty($order_assigned_agent)){
				    	$order_assigned_agent = 0;
						$agent_id = 0;
				    }

				    if (intval($customer_id) === 0){
						if (isset($_POST['customer_user'])){
							$customer_id = sanitize_text_field($_POST['customer_user']);
						}
					}
					
				   
				    
				    // Step 4: Now that we have the agent of the order, we must calculate earnings
				    // We begin by getting all rules applicable to this agent
				    $agent_group_id = get_user_meta($agent_id,'salesking_group', true);

				    if ($order_assigned_agent !== 0){
				    	$rules = $this->get_all_agent_rules($agent_id);
				    } else {
				    	$rules = $this->get_all_agent_rules($agent_id, 'yes'); // all rules for all agents
				    }


				    $rules = $this->filter_which_rules_apply_to_customer($rules, $customer_id);
				    $rules = $this->filter_which_rules_apply_to_order($rules, $order_id, $customer_id, $agent_id);



				    // Step 5: Calculate earnings

				    // 5.1 check if there is a different commission for above price
				    // apply that commission indifferent of commission rules
				    $agent_id = $order_assigned_agent;
				    $above_original_price = 0;
				    $above_original_price_commission = 0;
				    $below_original_price = 0;

				    // check if discounts should be taken from agent's commission
			        if (intval(get_option( 'salesking_take_out_discount_agent_commission_setting', 1 )) === 1 && $order_assigned_agent !== 0){
			        	// if order is placed by agent on behalf of customer, calculate commission on edited increased price
			    		if ($this->check_user_is_agent_with_access() || $this->agent_can_edit_price_for_themselves()){
			        		$agent_id = $this->get_current_agent_id();
			        		if ($agent_id !== $order->get_customer_id() || $this->agent_can_edit_price_for_themselves()){
			        		
			        			// Iterating through each "line" items in the order
			        			foreach ($order->get_items() as $item_id => $item ) {
			        				$original_price = $item->get_meta('_salesking_original_price');
			        				$set_price = $item->get_meta('_salesking_set_price');
			        				$quantity = $item->get_quantity();
			        				if (!empty($original_price) && !empty($set_price)){
			        					$original_price = floatval($original_price);
			        					$set_price = floatval($set_price);
			        					if ($set_price < $original_price){
			        						// price difference
			        						$below_original_price += ($original_price-$set_price)*$quantity;
			        					}
			        				}
			        			}
			        		}
			        	}
			        }

				    if (intval(get_option( 'salesking_different_commission_price_increase_setting', 1 )) === 1 && $order_assigned_agent !== 0){
				    	// if order is placed by agent on behalf of customer, calculate commission on edited increased price
						if ($this->check_user_is_agent_with_access() || $this->agent_can_edit_price_for_themselves()){
				    		$agent_id = $this->get_current_agent_id();
				    		if ($agent_id !== $order->get_customer_id() || $this->agent_can_edit_price_for_themselves()){
				    		
				    			// Iterating through each "line" items in the order
				    			foreach ($order->get_items() as $item_id => $item ) {
				    				$original_price = $item->get_meta('_salesking_original_price');
				    				$set_price = $item->get_meta('_salesking_set_price');
				    				$quantity = $item->get_quantity();
				    				if (!empty($original_price) && !empty($set_price)){
				    					$original_price = floatval($original_price);
				    					$set_price = floatval($set_price);
				    					if ($set_price > $original_price){
				    						// price difference
				    						$above_original_price += ($set_price-$original_price)*$quantity;
				    						$above_original_price_commission += ($set_price-$original_price)*$quantity*get_option('salesking_different_commission_price_increase_number_setting', 100 )/100;
				    					}
				    				}
				    			}
				    		}
				    	}
				    }

				    // 5.2 now apply rules for the rest (item price < increased price by agent)
				    $commission_rules_total = 0;
				    $commission_log = array();
				    $rules_apply_log = array();
				    $commission_by_agent = array(); // here we hold agent ID and commission in the case of individual agent rules


					foreach ($order->get_items() as $item_id => $item ) {

						// Get the WC_Order_Item_Product object properties in an array
					    $item_data = $item->get_data();

					    if ($item['quantity'] > 0) {

					        // get the WC_Product object
					        $product_id = $item['product_id'];

					        if (isset($item['variation_id'])){
					        	if (intval($item['variation_id']) !== 0){
					        		$product_id = $item['variation_id'];
					        	}
					        }

							$rules_that_apply_to_product = $this->filter_which_rules_apply_to_product($rules, $order_id, $customer_id, $product_id);
							$possible_parent_id = wp_get_post_parent_id($product_id);
							if ($possible_parent_id !== 0){
								$rules_that_apply_to_parent = $this->filter_which_rules_apply_to_product($rules, $order_id, $customer_id, $possible_parent_id);
								$rules_that_apply_to_product = array_merge($rules_that_apply_to_product, $rules_that_apply_to_parent);
								$rules_that_apply_to_product = array_unique(array_filter($rules_that_apply_to_product));
							}


							$rules_that_apply_to_product = $helper->get_rules_apply_priority($rules_that_apply_to_product);

							$rules_apply_log[]=array('Product ID: '.$product_id, 'All rules: '.serialize($rules), 'Rules that apply: '.serialize($rules_that_apply_to_product));

							if (!empty($rules_that_apply_to_product)){
								// get the calculation basis for the product (amount < increased price if setting is enabled)
								$original_price = $item->get_meta('_salesking_original_price');
								$set_price = $item->get_meta('_salesking_set_price');

								if (floatval($set_price) === floatval(0) && $set_price !== ''){
									continue; // no commission on this item, if item price is 0
								}

								$quantity = $item->get_quantity();
								if (!empty($original_price) && intval(get_option( 'salesking_different_commission_price_increase_setting', 1 )) === 1){
									if (intval(get_option( 'salesking_commissions_calculated_including_tax_setting', 1 )) === 1){
										//$calculation_basis = floatval($original_price) * $quantity;
										// calculate price without tax based on original price
										$price_without_tax_edited_price = round($item->get_total(), 2) + round($item->get_total_tax(), 2);
										$ratio = $price_without_tax_edited_price / $set_price;
										$price_without_tax_original_price = $ratio * floatval($original_price) * $quantity;

										$calculation_basis = $price_without_tax_original_price;
									} else {
										// calculate price without tax based on original price
										$price_without_tax_edited_price = round($item->get_total(), 2);
										// change in v 1.5.03 it used to be $set_price only
										$ratio = $price_without_tax_edited_price / ($set_price*$quantity);
										$price_without_tax_original_price = $ratio * floatval($original_price) * $quantity;

										$calculation_basis = $price_without_tax_original_price;
									}

								} else {
									$item_total = round($item->get_total(), 2); // Get the item line total discounted
									$item_total_tax = round($item->get_total_tax(), 2); // Get the item line total  tax discounted

									if (intval(get_option( 'salesking_commissions_calculated_including_tax_setting', 1 )) === 1){
										$calculation_basis = ($item_total + $item_total_tax);
									} else {
										$calculation_basis = $item_total;
									}
								}

								if (intval(get_option( 'salesking_commissions_calculated_based_profit_setting', 0 )) === 1){
									// overwrite completely, exclusively based on profit, tax irrelevant
									if ( class_exists( 'Alg_WC_Cost_of_Goods' ) ) {
										if (empty($original_price) or floatval($set_price) < floatval($original_price)){
											$price_without_tax = round($item->get_total(), 2);
										} else {
											$price_without_tax_edited_price = round($item->get_total(), 2);
											$ratio = $price_without_tax_edited_price / ($set_price*$quantity);
											$price_without_tax = $ratio * floatval($original_price) * $quantity;
										}

										$cost_id = $product_id;
										if (isset($item['variation_id'])){
											if (intval($item['variation_id']) !== 0){
												$cost_id = $item['variation_id'];
											}
										}

										$product_cost_temp = alg_wc_cog()->core->products->get_product_cost( $cost_id ) * $quantity;

										$product_cost = apply_filters('salesking_product_cost', $product_cost_temp, $cost_id, alg_wc_cog()->core->products->get_product_cost( $cost_id ), $quantity, $order);
		
										$profit = $price_without_tax - $product_cost;
										$calculation_basis = $profit;
									}
								}

								$fixed_commission_amount = $this->get_commission_amount($rules_that_apply_to_product, $calculation_basis, 'fixed', $quantity);
								$percentage_commission_amount = $this->get_commission_amount($rules_that_apply_to_product, $calculation_basis, 'percentage', $quantity);

								if (intval(get_option( 'salesking_individual_agents_auto_commissions_setting', 0 )) === 1){
									// who is the agent of the applied rule (for individual agent commission rules)
									$fixed_rules_agent = $this->get_commission_amount_rules_agent($rules_that_apply_to_product, $calculation_basis, 'fixed', $quantity);
									$percentage_rules_agent = $this->get_commission_amount_rules_agent($rules_that_apply_to_product, $calculation_basis, 'percentage', $quantity);

									if (!isset($commission_by_agent[$fixed_rules_agent])){
										$commission_by_agent[$fixed_rules_agent] = $fixed_commission_amount;
									} else {
										$commission_by_agent[$fixed_rules_agent] += $fixed_commission_amount;
									}

									if (!isset($commission_by_agent[$percentage_rules_agent])){
										$commission_by_agent[$percentage_rules_agent] = $percentage_commission_amount;
									} else {
										$commission_by_agent[$percentage_rules_agent] += $percentage_commission_amount;
									}
								}
				
						
								$item_commission = $fixed_commission_amount + $helper->get_multicurrency_price($order->get_id(), $percentage_commission_amount);
								$commission_rules_total += $item_commission;

								// log into database for reference / debugging purposes
								$item_log = array('Product ID: '.$product_id, 'Fixed commission: '.$fixed_commission_amount, 'Percentage commission: '.$percentage_commission_amount, 'Total commission: '.$item_commission, 'Rules that apply: '.serialize($rules_that_apply_to_product), 'Calculation basis value: '.$calculation_basis);
								$commission_log[] = $item_log;

							}
						}
					}

					if ($order_assigned_agent !== 0){

						// 5.3 apply rules that apply once per order
						$rules_that_apply_once = $this->filter_which_rules_apply_once($rules, $order_id, $customer_id, $product_id);
						
						$rules_that_apply_once = $helper->get_rules_apply_priority($rules_that_apply_once);


						if (!empty($rules_that_apply_once)){
							// get order total calculation basis
							if (intval(get_option( 'salesking_commissions_calculated_including_tax_setting', 1 )) === 1){
								$calculation_basis = $order->get_total();
							} else {
								$calculation_basis = $order->get_total() - $order->get_total_tax();
							}

							// check if any items have increased price, and if they do, set the calculation basis to original price
							if (intval(get_option( 'salesking_different_commission_price_increase_setting', 1 )) === 1){
								$original_total = 0;
								$items_increased_price = 'no';

								foreach ($order->get_items() as $item_id => $item ) {

									// Get the WC_Order_Item_Product object properties in an array
								    $item_data = $item->get_data();
								    if ($item['quantity'] > 0) {
										// get the calculation basis for the product (amount < increased price if setting is enabled)
										$original_price = $item->get_meta('_salesking_original_price');
										$quantity = $item->get_quantity();
										$set_price = $item->get_meta('_salesking_set_price');

										if (!empty($original_price) && $original_price !== $set_price && floatval($set_price) > floatval($original_price)){
											$items_increased_price = 'yes';

											if (intval(get_option( 'salesking_commissions_calculated_including_tax_setting', 1 )) === 1){
												$original_total += floatval($original_price) * $quantity;
											} else {
												// calculate price without tax based on original price
												$price_without_tax_edited_price = round($item->get_total(), 2);
												$ratio = $price_without_tax_edited_price / $set_price;
												$price_without_tax_original_price = $ratio * floatval($original_price) * $quantity;

												$original_total += $price_without_tax_original_price;
											}
										}
									}
								}

								if ($items_increased_price === 'yes'){
									// reset calculation basis depending on original total
									$calculation_basis = $original_total;
								}
							}

							if (intval(get_option( 'salesking_commissions_calculated_based_profit_setting', 0 )) === 1){
								// overwrite completely, exclusively based on profit, tax irrelevant
								if ( class_exists( 'Alg_WC_Cost_of_Goods' ) ) {
									// ignore shipping and tax

									$total_cost = 0;
									$total_price = 0;
									// first calculate all products cost
									foreach ($order->get_items() as $item_id => $item ) {

									    if ($item['quantity'] > 0) {
									    	$product_id = $item['product_id'];

									    	$cost_id = $product_id;
									    	if (isset($item['variation_id'])){
									    		if (intval($item['variation_id']) !== 0){
									    			$cost_id = $item['variation_id'];
									    		}
									    	}
									    	
									    	$product_cost_temp = alg_wc_cog()->core->products->get_product_cost( $cost_id ) * $item['quantity'];
									    	$cost = apply_filters('salesking_product_cost', $product_cost_temp, $cost_id, alg_wc_cog()->core->products->get_product_cost( $cost_id ), $item['quantity'], $order);

									    	$total_cost += $cost;


									    	$original_price = $item->get_meta('_salesking_original_price');
									    	if (!empty($original_price) && $original_price !== $set_price && floatval($set_price) > floatval($original_price)){
									    		$total_price += floatval($original_price) * $quantity;
									    	} else {
									    		$total_price += round($item->get_total(), 2) * $quantity;
									    	}
									    }
									}

									$total_profit = $total_price - $total_cost;

									$calculation_basis = $total_profit;
								}
							}

							$calculation_basis = apply_filters('salesking_custom_calculation_basis', $calculation_basis, $order);

							$fixed_commission_amount = $this->get_commission_amount_once($rules_that_apply_once, $calculation_basis, 'fixed');
							$percentage_commission_amount = $this->get_commission_amount_once($rules_that_apply_once, $calculation_basis, 'percentage');

							$item_commission = $fixed_commission_amount + $helper->get_multicurrency_price($order->get_id(), $percentage_commission_amount);

							$commission_rules_total += $item_commission;

						}
					}

					$commission_rules_total = round($commission_rules_total, 2);
					$above_original_price = round($above_original_price, 2);
					$below_original_price = round($below_original_price, 2);
					$above_original_price_commission = round($above_original_price_commission, 2);


					// convert to woocs currency base
					$above_original_price_commission = $helper->get_multicurrency_price($order->get_id(), $above_original_price_commission);
				//	$commission_rules_total = $helper->get_multicurrency_price($order->get_id(), $commission_rules_total);
					$below_original_price = $helper->get_multicurrency_price($order->get_id(), $below_original_price);


					// Step 6: Finally create and set earnings
					$all_earnings_total = round( ($above_original_price_commission + $commission_rules_total - $below_original_price), 2); //calculate all here
					$all_earnings_total = apply_filters('salesking_final_commission_value', $all_earnings_total, $order);

					// reference / log
					$order->update_meta_data('commission_log_before', $commission_log);
					$order->update_meta_data('rules_apply_log_before', $rules_apply_log);

					if ($all_earnings_total > apply_filters('salesking_earnings_total_threshold', 0 )){

						// Create transaction
						$earning = array(
						    'post_title' => sanitize_text_field(esc_html__('Earning','salesking')),
						    'post_status' => 'publish',
						    'post_type' => 'salesking_earning',
						    'post_author' => 1,
						);

						$earning_post_id = $order->get_meta('salesking_earning_id');
						if (empty($earning_post_id)){
							// earning does not exist yet.
							$recalculate = false;
							$earning_post_id = wp_insert_post($earning);
						}

						// reference / log
						update_post_meta($earning_post_id, 'commission_log', $commission_log);
						update_post_meta($earning_post_id, 'rules_apply_log', $rules_apply_log);

						// set meta
						update_post_meta($earning_post_id, 'time', time());
						update_post_meta($earning_post_id, 'order_id', $order_id);
						update_post_meta($earning_post_id, 'customer_id', $order->get_customer_id());
						update_post_meta($earning_post_id, 'order_status', $order->get_status());

						if ($agent_id !== 0){
							update_post_meta($earning_post_id, 'agent_id', $agent_id);
						} else {
							// get a first agent
							if ($order_assigned_agent === 0){
								unset($commission_by_agent[0]);
								
								$first_agent = array_key_first($commission_by_agent);
								update_option('earning_key_first', $first_agent);
								update_post_meta($earning_post_id,'agent_id', array_key_first($commission_by_agent)); // first agent is the one with the commissions
								update_post_meta($earning_post_id,'individual_agents_earnings', 'yes'); // first agent is the one with the commissions
							}
						}

						// create transaction as pending if the agent did collect extra over original price
						if ($above_original_price > 0){
							update_post_meta($earning_post_id, 'above_original_price', $above_original_price);
							update_post_meta($earning_post_id, 'above_original_price_commission', $above_original_price_commission);
						}

						if ($below_original_price > 0){
							update_post_meta($earning_post_id, 'below_original_price', $below_original_price);
						}

						if ($commission_rules_total > 0){
							update_post_meta($earning_post_id, 'commission_rules_total', $commission_rules_total);
						}

						$order->update_meta_data('salesking_earning_id', $earning_post_id);

						if ($recalculate){
							$earnings_total = floatval(get_post_meta($earning_post_id, 'salesking_commission_total', true));
							$earnings_status = get_post_meta($earning_post_id, 'order_status', true);
							
							$edited_earnings = $all_earnings_total; // new earnings

							if (!empty($edited_earnings)) {
							    // Update commission
							    update_post_meta($earning_post_id, 'salesking_commission_total', $edited_earnings);

							    if (in_array($earnings_status, apply_filters('salesking_earning_completed_statuses', array('completed')))) {
							        // Update agent outstanding balance
							        $old_balance = get_user_meta($agent_id, 'salesking_outstanding_earnings', true);
							        $modification = floatval($earnings_total) - floatval($edited_earnings);
							        $new_balance = floatval($old_balance) - $modification;

							        // User balance history
							        $date = date_i18n('Y/m/d', time() + (get_option('gmt_offset') * 3600));
							        $amount = 'ORDER RECALCULATION';
							        $note = sprintf('Order #%s recalculation', $order_id);
							        $user_balance_history = sanitize_text_field(get_user_meta($agent_id, 'salesking_user_balance_history', true));
							        $new_entry = $date . ':' . $amount . ':' . $old_balance . ':' . $new_balance . ':' . $note;
							        
							        update_user_meta($agent_id, 'salesking_user_balance_history', $user_balance_history . ';' . $new_entry);
							        update_user_meta($agent_id, 'salesking_outstanding_earnings', $new_balance);
							    }
							}
						} else {
							update_post_meta($earning_post_id, 'salesking_commission_total', $all_earnings_total);

						}

						if ($order_assigned_agent === 0){

							// first agent in commission by agent var
							update_post_meta($earning_post_id, 'salesking_commission_total', $helper->get_multicurrency_price($order->get_id(), $commission_by_agent[array_key_first($commission_by_agent)]));

							unset($commission_by_agent[array_key_first($commission_by_agent)]);

							$agents_of_earning = array();

							foreach ($commission_by_agent as $agent_id => $commission_value){
								update_post_meta($earning_post_id, 'parent_agent_id_'.$agent_id, $agent_id);
								update_post_meta($earning_post_id, 'parent_agent_id_'.$agent_id.'_earnings', $helper->get_multicurrency_price($order->get_id(), $commission_value));
								array_push($agents_of_earning, $agent_id);

							}
						} else {

							// Step 7: We must check if current agent is subagent, -> if any of this should go to parent account
							// get all earnings rules that apply to subagent

							if (apply_filters('salesking_calculation_apply_step_7', true)){
								$rules = $this->filter_which_rules_are_earnings_rules($rules);

								$subagent_id = $agent_id;

								// if user is indeed a subagent (has a parent) // recursive, all parents up the chain
								$parent_agent = get_user_meta($subagent_id,'salesking_parent_agent', true);

								$agents_of_earning = array();

								$all_earnings_total_original = $all_earnings_total;

								$i = 1;
								$max_agents = apply_filters('salesking_max_parent_agents_commission', 1000000);

								$all_earnings_total = apply_filters('salesking_parent_agent_calculation_basis', $all_earnings_total, $order);

								while (!empty($parent_agent) && $i <= $max_agents){

									array_push($agents_of_earning, $parent_agent);

									/*
									CHANGE SALESKING 1.3.0
									Calculation now based on PARENT RULES
									START
									*/
									$parentrules = $this->get_all_agent_rules($parent_agent);
									$parentrules = $this->filter_which_rules_are_earnings_rules($parentrules);
									$parentrules = $this->filter_which_earnings_rules_apply($parentrules, $subagent_id);


									// replaced 	$parent_earnings = $this->get_parent_total_earnings($rules, $all_earnings_total);
									$parent_earnings = $this->get_parent_total_earnings($parentrules, $all_earnings_total);

									/* CHANGE 1.3.0 END */


									if (intval(get_option( 'salesking_substract_subagent_earnings_agent_setting', 0 )) === 1){
										/* example order was 20000, with 10% parent ag com
										Normally it would go to agent 1 = 2000, ag 2 = 200, ag 3 = 20
										here we must adjust so that for 3 agents we end up with agent 1 = 1800, agent 2 = 180, agent 3 = 20
										*/
										// if first agent, remove from original commission
										if ($i === 1){
											$substracted = $all_earnings_total_original - $parent_earnings;
											update_post_meta($earning_post_id, 'salesking_commission_total', $substracted);
										} else {
											// subsequent agents
											$substracted = $all_earnings_total - $parent_earnings;
											update_post_meta($earning_post_id, 'parent_agent_id_'.$subagent_id.'_earnings', $substracted);

										}
									}

									update_post_meta($earning_post_id, 'parent_agent_id_'.$parent_agent, $parent_agent);
									update_post_meta($earning_post_id, 'parent_agent_id_'.$parent_agent.'_earnings', $parent_earnings);

									// if there is any rule based on "single value", then always use all_earnings_total_original, do not cascade values
									if ($this->have_single_value_earnings_rules($parentrules)){
										// do not cascade values
									} else {
										$all_earnings_total = $parent_earnings;
									}


									$subagent_id = $parent_agent;
									$parent_agent = get_user_meta($subagent_id,'salesking_parent_agent', true);
									$i++;

								}
							}

							
						}

						
						update_post_meta($earning_post_id, 'created_in', 'frontend_register_order');

						update_post_meta($earning_post_id, 'agents_of_earning', $agents_of_earning);

						// Step 8: Apply TOTAL GROUP Rules (e.g. change agent group on threshold reached)
						// check if there are any group rules that apply to this agent's group

						$group_rules_applicable = $this->get_group_rules($agent_group_id);
						// foreach rule, check if the condition is met, and then apply it
						foreach ($group_rules_applicable as $group_rule_id){
							$howmuch = get_post_meta($group_rule_id,'salesking_rule_howmuch', true);
							$newgroup = get_post_meta($group_rule_id, 'salesking_rule_who', true);
							$newgroup_id = explode('_', $newgroup)[1];

							$condition = get_post_meta($group_rule_id, 'salesking_rule_applies', true);

							$total_orders_amount = $total_agent_commissions = 0;

							$group_rules_args = apply_filters('salesking_group_rules_args', array( 
							    'post_type' => 'salesking_earning',
							    'numberposts' => -1,
							    'post_status'    => 'any',
							    'fields'    => 'ids',
							    'meta_key'   => 'agent_id',
							    'meta_value' => $agent_id,
							), $agent_id);
							// get total agent commissions
							$earnings = get_posts( $group_rules_args );

							foreach ($earnings as $earning_id){
							    $order_id = get_post_meta($earning_id,'order_id', true);
							    $orderobj = wc_get_order($order_id);
							    if ($orderobj !== false){
								    $earnings_total = get_post_meta($earning_id,'salesking_commission_total', true);
								    if (!empty($earnings_total) && floatval($earnings_total) !== 0){
								        $status = $orderobj->get_status();
								        $order_total = $orderobj->get_total();
								        if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
								        	$total_agent_commissions+=$earnings_total;
								        	$total_orders_amount += $order_total;
								        }
								        if (in_array($status, apply_filters('salesking_group_rules_allowed_statuses', array()))){
								        	$total_agent_commissions+=$earnings_total;
								        	$total_orders_amount += $order_total;
								        }

								    }
								}
							}

							$site_time = time()+(get_option('gmt_offset')*3600);
							$current_day = date_i18n( 'd', $site_time );
							

							// also get all earnings where this agent is parent
							$group_rules_args_parent = apply_filters('salesking_group_rules_args_parent', array( 
							    'post_type' => 'salesking_earning',
							    'numberposts' => -1,
							    'post_status'    => 'any',
							    'date_query' => array(
							            'after' => date('Y-m-d', strtotime('-'.$current_day.' days')) 
							        ),
							    'fields'    => 'ids',
							    'meta_key'   => 'parent_agent_id_'.$agent_id,
							    'meta_value' => $agent_id,
							), $agent_id);

							$earnings = get_posts( $group_rules_args_parent );

							foreach ($earnings as $earning_id){
							    $order_id = get_post_meta($earning_id,'order_id', true);
							    $orderobj = wc_get_order($order_id);
							    if ($orderobj !== false){
								    $status = $orderobj->get_status();
								    $earnings_total = get_post_meta($earning_id,'parent_agent_id_'.$agent_id.'_earnings', true);
								    // check if approved
								    if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
								        $total_agent_commissions+=$earnings_total;
								    }
								    if (in_array($status, apply_filters('salesking_group_rules_allowed_statuses', array()))){
								    	$total_agent_commissions+=$earnings_total;
								    }
								}
							}

							$total_orders_amount = apply_filters('salesking_group_monthly_earnings', $total_orders_amount, $total_agent_commissions, $agent_id);
							
							if ($condition === 'earnings_total'){
								// calculate agent earnings total
								if ($total_agent_commissions >= $howmuch){
									// change group
									update_user_meta($agent_id,'salesking_group', $newgroup_id);
									do_action('salesking_group_rules_change', $agent_id, $newgroup_id);
								}
							}

							if ($condition === 'order_value_total'){
								// calculate agent order value total
								if ($total_orders_amount >= $howmuch){
									// change group
									update_user_meta($agent_id,'salesking_group', $newgroup_id);
									do_action('salesking_group_rules_change', $agent_id, $newgroup_id);
								}
							}
						}



					}
				}
				

				do_action('salesking_after_calculated_earnings', $order_id, get_current_user_id());

			}
			
		}

		if ($order){
			$order->save();
		}
	}

	//Apply MONTHLY GROUP Rules (e.g. change agent group on threshold reached)
	function monthly_group_rules(){

		$current_month = date('mY');

		// check if it's already been applied this month
		if (get_option('salesking_monthly_rules_calculated_'.$current_month) !== 'yes'){
			// here we calculated based on the values in the previous month (total orders value / earnings reached)

			// Get all agents
		    $agents = get_users(array(
			    'meta_key'     => 'salesking_group',
			    'meta_value'   => 'none',
			    'meta_compare' => '!=',
			    'fields' => 'ids',
			));

			
			// Get all monthly group rules 
			// get all group rules
			$group_rules = get_posts([
	    		'post_type' => 'salesking_grule',
	    	  	'post_status' => 'publish',
	    	  	'numberposts' => -1,
	    	  	'fields'	=> 'ids',
	    	]);

			$monthly_rules = array();
			foreach ($group_rules as $grule_id){
				$type = get_post_meta($grule_id,'salesking_rule_applies', true);
				if ($type === 'earnings_monthly' || $type === 'order_value_monthly'){
					array_push($monthly_rules, $grule_id);
				}
			}

			
			foreach ($agents as $agent){
				$agent_id = $agent;
				$agent_group = get_user_meta($agent, 'salesking_group', true);

				// get agent monthly earnings
				// get agent monthly order total

				$total_orders_amount = $total_agent_commissions = 0;
				// get total agent commissions
				$earnings = get_posts( array( 
				    'post_type' => 'salesking_earning',
				    'numberposts' => -1,
				    'post_status'    => 'any',
				    'fields'    => 'ids',
				    'meta_key'   => 'agent_id',
				    'meta_value' => $agent_id,
			        'year' => date('Y', strtotime(date('Y-m')." -1 month")),
			        'monthnum' => date('n', strtotime(date('Y-m')." -1 month"))
				));

				foreach ($earnings as $earning_id){
				    $order_id = get_post_meta($earning_id,'order_id', true);
				    $orderobj = wc_get_order($order_id);
				    if ($orderobj !== false){
					    $earnings_total = get_post_meta($earning_id,'salesking_commission_total', true);
					    if (!empty($earnings_total) && floatval($earnings_total) !== 0){
					        $status = $orderobj->get_status();
					        $order_total = $orderobj->get_total();

					        $statuses_usable = apply_filters('salesking_group_rules_statuses', array('completed','wc-completed'));
					        if (in_array($status, $statuses_usable)){
						        $total_agent_commissions+=$earnings_total;
						        $total_orders_amount += $order_total;
						    }
					    }
					}
				}				

				// also get all earnings where this agent is parent
				$earnings = get_posts( array( 
				    'post_type' => 'salesking_earning',
				    'numberposts' => -1,
				    'post_status'    => 'any',
				    'year' => date('Y', strtotime(date('Y-m')." -1 month")),
				    'monthnum' => date('n', strtotime(date('Y-m')." -1 month")),
				    'fields'    => 'ids',
				    'meta_key'   => 'parent_agent_id_'.$agent_id,
				    'meta_value' => $agent_id,
				));

				foreach ($earnings as $earning_id){
				    $order_id = get_post_meta($earning_id,'order_id', true);
				    $orderobj = wc_get_order($order_id);
				    if ($orderobj !== false){
					    $status = $orderobj->get_status();

					    $statuses_usable = apply_filters('salesking_group_rules_statuses', array('completed','wc-completed'));
					    if (in_array($status, $statuses_usable)){
						    $earnings_total = get_post_meta($earning_id,'parent_agent_id_'.$agent_id.'_earnings', true);
						    $total_agent_commissions+=$earnings_total;
						}

					}
				}

				// check rules 
				foreach ($monthly_rules as $grule_id){
					$group1 = explode('_',get_post_meta($grule_id,'salesking_rule_agents_who', true))[1];
					$group2 = explode('_',get_post_meta($grule_id,'salesking_rule_who', true))[1];
					$type = get_post_meta($grule_id,'salesking_rule_applies', true);
					$howmuch = get_post_meta($grule_id,'salesking_rule_howmuch', true);

					// if agent group is group 1, check type agent value and condition, and if pass, promote to group 2
					if ($agent_group === $group1){
						if ($type === 'order_value_monthly'){
							if ($total_orders_amount > $howmuch){
								// promote to group 2
								update_user_meta($agent_id,'salesking_group', $group2);
								do_action('salesking_group_rules_change', $agent_id, $group2);

								break;
							}
						} else if ($type === 'earnings_monthly'){
							if ($total_agent_commissions > $howmuch){
								// promote to group 2
								update_user_meta($agent_id,'salesking_group', $group2);
								do_action('salesking_group_rules_change', $agent_id, $group2);

								break;
							}
						}
					// else if agent group is group 2, check type agent value and condition, and if fail, demote to group 1
					} else if ($agent_group === $group2){
						if ($type === 'order_value_monthly'){
							if ($total_orders_amount < $howmuch){
								// demote to group 1
								update_user_meta($agent_id,'salesking_group', $group1);
								do_action('salesking_group_rules_change', $agent_id, $group1);

								break;
							}
						} else if ($type === 'earnings_monthly'){
							if ($total_agent_commissions < $howmuch){
								// demote to group 1
								update_user_meta($agent_id,'salesking_group', $group1);
								do_action('salesking_group_rules_change', $agent_id, $group1);

								break;
							}
						}
					}

				}

			}

			// calculated finish 
			update_option('salesking_monthly_rules_calculated_'.$current_month, 'yes');
		}

	}

	function salesking_private_sales_agent_notes( $fields ) {

		if ($this->check_user_is_agent_with_access()){
			$args = array(
				'type'        => 'textarea',
				'class'       => array( 'notes' ),
				'label'       => __( 'Private Sales Agent Notes', 'salesking' ),
				'placeholder' => esc_attr__(
					'These notes are visible to the shop, but not visible to the customer.',
					'woocommerce'
				)
			);
			$args = apply_filters('salesking_private_agent_notes_args', $args);
			
			$agent_orders_box = array('agent_order_comments' => $args);
			$fields['order'] = array_merge($fields['order'], $agent_orders_box);
		}

	    return $fields;
	}

	function salesking_save_private_note($order_id){
        $order = wc_get_order( $order_id );
        $customer_id = $order->get_customer_id();

        if (isset($_POST['agent_order_comments'])){
        	$pretext = esc_html__('The following note was added by the sales agent:','salesking').'<br><br>';
        	$comments = sanitize_textarea_field($_POST['agent_order_comments']);
        	if (!empty($comments)){
        		$order->add_order_note( $pretext . $comments);
        	}
        }
	}

	// returns all group rules (salesking_grule) that apply to this group id
	function get_group_rules($agent_group_id){

		if (empty($agent_group_id)){
			return array();
		}

		$rules_that_apply = array();
		// get all group rules
		$group_rules = get_posts([
	    		'post_type' => 'salesking_grule',
	    	  	'post_status' => 'publish',
	    	  	'numberposts' => -1,
	    	  	'fields'	=> 'ids',
	    	]);

		foreach ($group_rules as $grule_id){
			$who = get_post_meta($grule_id,'salesking_rule_agents_who', true);
			if ($who === 'group_'.$agent_group_id){
				array_push($rules_that_apply, $grule_id);
				continue;
			}

			if ($who === 'multiple_options'){
				$multiple_options = get_post_meta($grule_id, 'salesking_rule_agents_who_multiple_options', true);
				$multiple_options_array = explode(',', $multiple_options);

				if (in_array('group_'.$agent_group_id, $multiple_options_array)){
					array_push($rules_that_apply, $grule_id);
					continue;
				}
			}
		}

		return $rules_that_apply;
	}


	function get_commission_amount_once($rules, $calculation_basis, $type_given){
		// find the highest commission of this type, among rules
		$highest_commission_howmuch = 0;
		foreach($rules as $rule_id){
			// if rule matches type
			$type = get_post_meta($rule_id,'salesking_rule_what', true);
			if ($type === $type_given){
				// rule matches
				$howmuch = floatval(get_post_meta($rule_id,'salesking_rule_howmuch', true));
				if ($howmuch > $highest_commission_howmuch){
					$highest_commission_howmuch = $howmuch;
				}
			}
		}

		if ($highest_commission_howmuch !== 0){
			$commission_value = 0;

			if ($type_given === 'percentage'){
				$commission_value = $calculation_basis * ($highest_commission_howmuch / 100);

			} else if ($type_given === 'fixed'){
				$commission_value = $highest_commission_howmuch;
			}

			return $commission_value;

		} else {
			return 0;
		}
	}

	function get_commission_amount_rules_agent($rules, $calculation_basis, $type_given, $quantity){
		// find the highest commission of this type, among rules
		$highest_commission_howmuch = 0;
		$applied_rule = 0;
		foreach($rules as $rule_id){
			// if rule matches type
			$type = get_post_meta($rule_id,'salesking_rule_what', true);
			if ($type === $type_given){
				// rule matches
				$howmuch = floatval(get_post_meta($rule_id,'salesking_rule_howmuch', true));
				if ($howmuch > $highest_commission_howmuch){
					$highest_commission_howmuch = $howmuch;
					$applied_rule = $rule_id;
				}
			}
		}

		if ($highest_commission_howmuch !== 0){
			// get agent ID
			$agent_id = explode('_',get_post_meta($rule_id,'salesking_rule_agents_who', true))[1];
			return $agent_id;

		} else {
			return 0;
		}
	}

	function get_commission_amount($rules, $calculation_basis, $type_given, $quantity){
		// find the highest commission of this type, among rules
		$highest_commission_howmuch = 0;
		foreach($rules as $rule_id){
			// if rule matches type
			$type = get_post_meta($rule_id,'salesking_rule_what', true);
			if ($type === $type_given){
				// rule matches
				$howmuch = floatval(get_post_meta($rule_id,'salesking_rule_howmuch', true));
				if ($howmuch > $highest_commission_howmuch){
					$highest_commission_howmuch = $howmuch;
				}
			}
		}

		if ($highest_commission_howmuch !== 0){
			$commission_value = 0;

			if ($type_given === 'percentage'){
				$commission_value = $calculation_basis * ($highest_commission_howmuch / 100);

			} else if ($type_given === 'fixed'){
				$commission_value = $highest_commission_howmuch * $quantity;
			}

			return $commission_value;

		} else {
			return 0;
		}
	}

	function get_parent_total_earnings($rules, $all_earnings_total){
		$total = 0;
	
		$highest_fixed = 0;
		$highest_percentage = 0;
		foreach($rules as $rule_id){
			// if rule matches type
			$type = get_post_meta($rule_id,'salesking_rule_what', true);
			if ($type === 'fixed'){
				// rule matches
				$howmuch = floatval(get_post_meta($rule_id,'salesking_rule_howmuch', true));
				if ($howmuch > $highest_fixed){
					$highest_fixed = $howmuch;
				}
			}

			if ($type === 'percentage'){
				// rule matches
				$howmuch = floatval(get_post_meta($rule_id,'salesking_rule_howmuch', true));
				if ($howmuch > $highest_percentage){
					$highest_percentage = $howmuch;
				}
			}
		}

		
		$total = $highest_fixed + ($all_earnings_total * $highest_percentage / 100);

		return $total;
	}

	// takes an array of rule IDs and returns the ones that are earnings rules
	function filter_which_rules_are_earnings_rules($rules){

		$rules_that_apply = array();
		foreach ($rules as $rule_id){
			$rule_orders = get_post_meta($rule_id,'salesking_rule_orders', true);
			$earnings_options = array('all_earnings', 'all_earnings_singlevalue', 'reach_x_number', 'first_x_earnings', 'first_x_days');
			if (in_array($rule_orders, $earnings_options )){
				array_push($rules_that_apply, $rule_id);
				continue;
			}
		}

		$rules_that_apply = array_filter(array_unique($rules_that_apply));
		return $rules_that_apply;
	}

	function have_single_value_earnings_rules($rules){

		$rules_that_apply = array();
		foreach ($rules as $rule_id){
			$rule_orders = get_post_meta($rule_id,'salesking_rule_orders', true);
			$earnings_options = array('all_earnings_singlevalue');
			if (in_array($rule_orders, $earnings_options )){
				array_push($rules_that_apply, $rule_id);
				continue;
			}
		}

		$rules_that_apply = array_filter(array_unique($rules_that_apply));

		if (empty($rules_that_apply)){
			return false;
		} else {
			return true;
		}
	}

	// takes an array of rule IDs and returns the ones that apply once per order
	function filter_which_rules_apply_once($rules, $order_id, $customer_id, $product_id){

		$rules_that_apply = array();
		foreach ($rules as $rule_id){
			$rule_applies = get_post_meta($rule_id,'salesking_rule_applies', true);

			if ($rule_applies === 'once_per_order'){
				array_push($rules_that_apply, $rule_id);
				continue;
			}
		}

		$rules_that_apply = array_filter(array_unique($rules_that_apply));
		return $rules_that_apply;
	}

	// takes an array of rule IDs and returns the ones that apply to the product
	public static function filter_which_rules_apply_to_product($rules, $order_id, $customer_id, $product_id){

		$rules_that_apply = array();
		foreach ($rules as $rule_id){
			$rule_applies = get_post_meta($rule_id,'salesking_rule_applies', true);

			// here we must eliminate earnings rules (as they do not apply to products individually)
			$rule_orders = get_post_meta($rule_id,'salesking_rule_orders', true);
			$earnings_options = array('all_earnings', 'all_earnings_singlevalue', 'reach_x_number', 'first_x_earnings', 'first_x_days');
			if (in_array($rule_orders, $earnings_options )){
				// skip to next
				continue;
			} 

			if ($rule_applies === 'cart_total'){
				array_push($rules_that_apply, $rule_id);
				continue;
			}

			$explosion = explode('_', $rule_applies);
			// if is category rule
			if ($explosion[0] === 'category'){
				$category_id = $explosion[1];
				// check if product has category
				if( has_term( $explosion[1], 'product_cat', $product_id ) ){
					array_push($rules_that_apply, $rule_id);
					continue;
				}

				// wpml
				if( has_term( apply_filters( 'wpml_object_id', $explosion[1], 'category', true  ), 'product_cat', $product_id ) ){
					array_push($rules_that_apply, $rule_id);
					continue;
				}
				if( has_term( $explosion[1], 'product_cat', apply_filters( 'wpml_object_id', $product_id, 'post', true  ) ) ){
					array_push($rules_that_apply, $rule_id);
					continue;
				}
				//wpml
			}

			// if is category rule
			if ($explosion[0] === 'tag'){
				$tag_id = $explosion[1];
				if( has_term( $explosion[1], apply_filters('salesking_rules_taxonomy_option', 'product_tag'), $product_id ) ){
					array_push($rules_that_apply, $rule_id);
					continue;
				}

				// wpml
				if( has_term( apply_filters( 'wpml_object_id', $explosion[1], 'post_tag', true  ), apply_filters('salesking_rules_taxonomy_option', 'product_tag'), $product_id ) ){
					array_push($rules_that_apply, $rule_id);
					continue;
				}
				if( has_term( $explosion[1], apply_filters('salesking_rules_taxonomy_option', 'product_tag'), apply_filters( 'wpml_object_id', $product_id, 'post', true  ) ) ){
					array_push($rules_that_apply, $rule_id);
					continue;
				}
				//wpml
			}

			// if is multiple
			if ($explosion[0] === 'multiple'){
				$multiple_options = get_post_meta($rule_id, 'salesking_rule_applies_multiple_options', true);
				$multiple_options_array = explode(',', $multiple_options);

				// check each option against the product
				foreach ($multiple_options_array as $option){
					$explosionoption = explode('_', $option);
					if ($explosionoption[0] === 'category'){
						// check if product has category
						if( has_term( $explosionoption[1], 'product_cat', $product_id ) ){
							array_push($rules_that_apply, $rule_id);
							break;
						}

						// wpml
						if( has_term( apply_filters( 'wpml_object_id', $explosionoption[1], 'category', true  ), 'product_cat', $product_id ) ){
							array_push($rules_that_apply, $rule_id);
							continue;
						}
						if( has_term( $explosionoption[1], 'product_cat', apply_filters( 'wpml_object_id', $product_id, 'post', true  ) ) ){
							array_push($rules_that_apply, $rule_id);
							continue;
						}
						//wpml

					} else if ($explosionoption[0] === 'tag'){
						// check if product has tag
						if( has_term( $explosionoption[1], apply_filters('salesking_rules_taxonomy_option', 'product_tag'), $product_id ) ){
							array_push($rules_that_apply, $rule_id);
							break;
						}

						// wpml
						if( has_term( apply_filters( 'wpml_object_id', $explosionoption[1], 'post_tag', true  ), apply_filters('salesking_rules_taxonomy_option', 'product_tag'), $product_id ) ){
							array_push($rules_that_apply, $rule_id);
							continue;
						}
						if( has_term( $explosionoption[1], apply_filters('salesking_rules_taxonomy_option', 'product_tag'), apply_filters( 'wpml_object_id', $product_id, 'post', true  ) ) ){
							array_push($rules_that_apply, $rule_id);
							continue;
						}
						//wpml
					}
				}

			}

			// if is product ids multiple
			if ($explosion[0] === 'replace'){
				$multiple_options = get_post_meta($rule_id, 'salesking_rule_product_ids', true);
				$multiple_options_array = explode(',', $multiple_options);

				// check each option against the product
				foreach ($multiple_options_array as $index => $option){
					$multiple_options_array[$index] = trim($option);
				}
				$multiple_options_array = array_filter(array_unique($multiple_options_array));

				if (in_array($product_id, $multiple_options_array)){
					array_push($rules_that_apply, $rule_id);
					break;
				}
				$possible_parent_id = wp_get_post_parent_id($product_id);
				if ($possible_parent_id !== 0){
					if (in_array($possible_parent_id, $multiple_options_array)){
						array_push($rules_that_apply, $rule_id);
						break;
					}
				}
			}

		}

		$rules_that_apply = array_filter(array_unique($rules_that_apply));
		return $rules_that_apply;
	}

	function filter_which_earnings_rules_apply($rules, $subagent_id){
		$rules_that_apply = array();
		foreach ($rules as $rule_id){
			$rule_x = floatval(get_post_meta($rule_id,'salesking_rule_x', true));

			$rule_orders = get_post_meta($rule_id,'salesking_rule_orders', true);

			// return here and apply subagents
			// if user is indeed a subagent (has a parent)

			if ($rule_orders === 'all_earnings' || $rule_orders === 'all_earnings_singlevalue'){
				array_push($rules_that_apply, $rule_id);
				continue;
			}

			if ($rule_orders === 'reach_x_number'){
				// until subagent earnings reach x total
				// get subagent earnings
				require_once ( SALESKING_DIR . 'includes/class-salesking-helper.php' );
				$helper = new Salesking_Helper();
				$subagent_earnings = $helper->get_agent_earnings($subagent_id);

				if ($rule_x >= $subagent_earnings){
					array_push($rules_that_apply, $rule_id);
					continue;
				}
			}

			if ($rule_orders === 'first_x_earnings'){
				$earnings_nr = count(get_posts( array( 
				    'post_type' => 'salesking_earning',
				    'numberposts' => -1,
				    'post_status'    => 'any',
				    'fields'    => 'ids',
				    'meta_key'   => 'agent_id',
				    'meta_value' => $subagent_id,
				)));

				if ($rule_x >= $earnings_nr){
					array_push($rules_that_apply, $rule_id);
					continue;
				}
			}

			if ($rule_orders === 'first_x_days'){
				// get days since registration
				$udata = get_userdata( $subagent_id );
				$registered = $udata->user_registered;
				$registered_time = strtotime( $registered );
				$current_time = time();
				$time_since_registration = $current_time - $registered_time;
				$days_since_registration = $time_since_registration / 86400;
				if ($rule_x >= $days_since_registration){
					array_push($rules_that_apply, $rule_id);
					continue;
				}
			}
			

		}

		$rules_that_apply = array_filter(array_unique($rules_that_apply));
		return $rules_that_apply;
	}

	// takes an array of rule IDs and returns the ones that apply to the order
	function filter_which_rules_apply_to_order($rules, $order_id, $customer_id, $agent_id){
		$rules_that_apply = array();
		foreach ($rules as $rule_id){
			$rule_orders = get_post_meta($rule_id,'salesking_rule_orders', true);

			
			// get customer registration date
			$udata = get_userdata( $customer_id );
			$guest_customer = false;
			if (!$udata){
				// guest customer
				$registered_time = 0;
				$guest_customer = true;
			} else {
				$registered = $udata->user_registered;
				$registered_time = strtotime( $registered );
			}

			
			// get current time
			$current_time = time();
			$time_since_registration = $current_time - $registered_time;
			$days_since_registration = $time_since_registration / 86400;
			// get rule x
			$rule_x = floatval(get_post_meta($rule_id,'salesking_rule_x', true));
			// ger order count
			$customer = new WC_Customer($customer_id);

			// placed by agent count
			$agent_order_count = count(wc_get_orders( array(
			    'limit'        => -1, // Query all orders
			    'return'	   => 'ids',
			    'customer_id'  => $customer_id,
			    'meta_key'     => 'salesking_order_placed_type', // The postmeta key field
			    'meta_value'   => 'placed_by_agent', // The comparison argument
			)));
			// placed by customer count
			$customer_order_count = count(wc_get_orders( array(
			    'limit'        => -1, // Query all orders
			    'return'	   => 'ids',
			    'customer_id'  => $customer_id,
			    'meta_key'     => 'salesking_order_placed_type', // The postmeta key field
			    'meta_value'   => 'placed_by_customer', // The comparison argument
			)));

			$order_count = $agent_order_count + $customer_order_count;


			$rule_min = get_post_meta($rule_id,'salesking_rule_min', true);
			$rule_max = get_post_meta($rule_id,'salesking_rule_max', true);

			$order = wc_get_order($order_id);
			if (intval(get_option( 'salesking_commissions_calculated_including_tax_setting', 1 )) === 1){
				$calculation_basis = $order->get_total();
			} else {
				$calculation_basis = $order->get_total() - $order->get_total_tax();
			}

			if ( ! apply_filters('salesking_rules_minmax_include_shipping', true)){
				$shipping = $order->get_shipping_total();
				$shipping_tax = $order->get_shipping_tax();
				if (intval(get_option( 'salesking_commissions_calculated_including_tax_setting', 1 )) === 1){
					$calculation_basis -= $shipping;
					$calculation_basis -= $shipping_tax;
				} else {
					// shipping tax has already been substracted
					$calculation_basis -= $shipping;
				}
			}

			// apply min max
			if (!empty($rule_min)){
				if ($calculation_basis < floatval($rule_min)){
					continue; // skip rule
				}
			}

			if (!empty($rule_max)){
				if ($calculation_basis > floatval($rule_max)){
					continue; // skip rule
				}
			}


			if ($rule_orders === 'all'){
				array_push($rules_that_apply, $rule_id);
				continue;
			}
			

			if ($rule_orders === 'all_first_days_after_registration'){
				if ($rule_x >= $days_since_registration){
					array_push($rules_that_apply, $rule_id);
					continue;
				}
			}

			if ($rule_orders === 'first_x_orders_after_registration'){
				if ($rule_x >= $order_count ){
					array_push($rules_that_apply, $rule_id);
					continue;
				}
			}

			// get order placed by
			$placed_by = $order->get_meta('salesking_order_placed_type');

			if ($rule_orders === 'all_agent' && $placed_by === 'placed_by_agent'){
				array_push($rules_that_apply, $rule_id);
				continue;
			}

			if (!$guest_customer){

				if ($rule_orders === 'all_agent_first_days_after_registration' && $placed_by === 'placed_by_agent'){
					if ($rule_x >= $days_since_registration){
						array_push($rules_that_apply, $rule_id);
						continue;
					}
				}

				if ($rule_orders === 'agent_first_x_orders_after_registration' && $placed_by === 'placed_by_agent'){
					if ($rule_x >= $agent_order_count ){
						array_push($rules_that_apply, $rule_id);
						continue;
					}
				}

				if ($rule_orders === 'all_customer_first_days_after_registration' && $placed_by === 'placed_by_customer'){
					if ($rule_x >= $days_since_registration){
						array_push($rules_that_apply, $rule_id);
						continue;
					}
				}

				if ($rule_orders === 'customer_first_x_orders_after_registration' && $placed_by === 'placed_by_customer'){
					if ($rule_x >= $customer_order_count ){
						array_push($rules_that_apply, $rule_id);
						continue;
					}
				}
			}

			// return here and apply subagents
			// if user is indeed a subagent (has a parent)
			$parent_agent = get_user_meta($agent_id,'salesking_parent_agent', true);
			if (!empty($parent_agent)){
				if ($rule_orders === 'all_earnings' || $rule_orders === 'all_earnings_singlevalue'){
					array_push($rules_that_apply, $rule_id);
					continue;
				}

				if ($rule_orders === 'reach_x_number'){
					// until subagent earnings reach x total
					// get subagent earnings
					require_once ( SALESKING_DIR . 'includes/class-salesking-helper.php' );
					$helper = new Salesking_Helper();
					$subagent_earnings = $helper->get_agent_earnings($agent_id);

					if ($rule_x >= $subagent_earnings){
						array_push($rules_that_apply, $rule_id);
						continue;
					}
				}

				if ($rule_orders === 'first_x_earnings'){
					$earnings_nr = count(get_posts( array( 
					    'post_type' => 'salesking_earning',
					    'numberposts' => -1,
					    'post_status'    => 'any',
					    'fields'    => 'ids',
					    'meta_key'   => 'agent_id',
					    'meta_value' => $agent_id,
					)));

					if ($rule_x >= $earnings_nr){
						array_push($rules_that_apply, $rule_id);
						continue;
					}
				}

				if ($rule_orders === 'first_x_days'){
					// get days since registration
					$udata = get_userdata( $agent_id );
					$registered = $udata->user_registered;
					$registered_time = strtotime( $registered );
					$current_time = time();
					$time_since_registration = $current_time - $registered_time;
					$days_since_registration = $time_since_registration / 86400;
					if ($rule_x >= $days_since_registration){
						array_push($rules_that_apply, $rule_id);
						continue;
					}
				}
			}

		}

		$rules_that_apply = array_filter(array_unique($rules_that_apply));
		return $rules_that_apply;
	}

	// takes an array of rule IDs and returns the ones that apply to the customer
	function filter_which_rules_apply_to_customer($rules, $customer_id){
		$rules_that_apply = array();
		foreach ($rules as $rule_id){
			// if it's an earning rule, customer does not apply, therefore rule is applied
			$rule_orders = get_post_meta($rule_id,'salesking_rule_orders', true);
			$earnings_options = array('all_earnings', 'all_earnings_singlevalue', 'reach_x_number', 'first_x_earnings', 'first_x_days');
			if (in_array($rule_orders, $earnings_options )){
				array_push($rules_that_apply, $rule_id);
				continue;
			} else {
				// not an earning rule, continue search
				$rule_who = get_post_meta($rule_id,'salesking_rule_who', true);
				// check if individual customer is set for the rule
				if ($rule_who === 'user_'.$customer_id){
					array_push($rules_that_apply, $rule_id);
					continue;
				} else {
					// check b2bking groups
					if (defined('B2BKING_DIR') || defined('B2BKINGCORE_DIR')){
						$user_is_b2b = get_user_meta($customer_id,'b2bking_b2buser', true);
						if ($user_is_b2b === 'yes'){
							if ($rule_who === 'everyone_registered_b2b'){
								array_push($rules_that_apply, $rule_id);
								continue;
							}
							$b2b_group = get_user_meta($customer_id,'b2bking_customergroup', true);
							if ($rule_who === 'group_'.$b2b_group){
								array_push($rules_that_apply, $rule_id);
								continue;
							}
						} else {
							if ($rule_who === 'everyone_registered_b2c'){
								array_push($rules_that_apply, $rule_id);
								continue;
							}
						}
					}

					//check main options here
					if ($rule_who === 'everyone'){
						array_push($rules_that_apply, $rule_id);
						continue;
					}

					if ($rule_who === 'all_registered' && intval($customer_id) !== 0){
						array_push($rules_that_apply, $rule_id);
						continue;
					}

					// check options with MULTIPLE
					if ($rule_who === 'multiple_options'){

						$multiple_options = get_post_meta($rule_id, 'salesking_rule_who_multiple_options', true);
						$multiple_options_array = explode(',', $multiple_options);

						if (in_array('everyone', $multiple_options_array)){
							array_push($rules_that_apply, $rule_id);
							continue;
						}
						if (in_array('all_registered', $multiple_options_array) && intval($customer_id) !== 0){
							array_push($rules_that_apply, $rule_id);
							continue;
						}

						if (defined('B2BKING_DIR') || defined('B2BKINGCORE_DIR')){
							$user_is_b2b = get_user_meta($customer_id,'b2bking_b2buser', true);
							if ($user_is_b2b === 'yes'){
								if (in_array('everyone_registered_b2b', $multiple_options_array)){
									array_push($rules_that_apply, $rule_id);
									continue;
								}
								$b2b_group = get_user_meta($customer_id,'b2bking_customergroup', true);
								if (in_array('group_'.$b2b_group, $multiple_options_array)){
									array_push($rules_that_apply, $rule_id);
									continue;
								}
							} else {
								if (in_array('everyone_registered_b2c', $multiple_options_array)){
									array_push($rules_that_apply, $rule_id);
									continue;
								}
							}
						}

						if (in_array('user_'.$customer_id, $multiple_options_array)){
							array_push($rules_that_apply, $rule_id);
							continue;
						} else {
							// try group
							if (in_array('group_'.$agent_group_id, $multiple_options_array)){
								array_push($rules_that_apply, $rule_id);
								continue;
							}
						}
					}
				}
			}
		}

		$rules_that_apply = array_filter(array_unique($rules_that_apply));
		return $rules_that_apply;
	}

	// returns an ARRAY of rule ids that apply to the agent
	function get_all_agent_rules($agent_id, $all_rules = 'no'){

		if ($all_rules === 'no'){
			// get rules that apply to all agents
			$all_agent_rules = get_posts([
		    		'post_type' => 'salesking_rule',
		    	  	'post_status' => 'publish',
		    	  	'numberposts' => -1,
		    	  	'fields'	=> 'ids',
		    	  	'meta_query'=> array(
		                'relation' => 'AND',
		                array(
	                        'key' => 'salesking_rule_agents_who',
	                        'value' => 'all_agents'
	                    )
		            )
		    	]);

			// get all individual rules
			$individual_rules = get_posts([
		    		'post_type' => 'salesking_rule',
		    	  	'post_status' => 'publish',
		    	  	'numberposts' => -1,
		    	  	'fields'	=> 'ids',
		    	  	'meta_query'=> array(
		                'relation' => 'AND',
		                array(
	                        'key' => 'salesking_rule_agents_who',
	                        'value' => 'agent_'.$agent_id
	                    )
		            )
		    	]);

			// get all group rules
			$agent_group_id = get_user_meta($agent_id,'salesking_group', true);

			$group_rules = get_posts([
		    		'post_type' => 'salesking_rule',
		    	  	'post_status' => 'publish',
		    	  	'numberposts' => -1,
		    	  	'fields'	=> 'ids',
		    	  	'meta_query'=> array(
		                'relation' => 'AND',
		                array(
	                        'key' => 'salesking_rule_agents_who',
	                        'value' => 'group_'.$agent_group_id
	                    )
		            )
		    	]);

			// get all multiple option rules
			$multiple_option_rules = get_posts([
		    		'post_type' => 'salesking_rule',
		    	  	'post_status' => 'publish',
		    	  	'numberposts' => -1,
		    	  	'fields'	=> 'ids',
		    	  	'meta_query'=> array(
		                'relation' => 'AND',
		                array(
	                        'key' => 'salesking_rule_agents_who',
	                        'value' => 'multiple_options'
	                    )
		            )
		    	]);

			$rules_that_apply = array();
			foreach ($multiple_option_rules as $rule_id){
				$multiple_options = get_post_meta($rule_id, 'salesking_rule_agents_who_multiple_options', true);
				$multiple_options_array = explode(',', $multiple_options);
				if (in_array('agent_'.$agent_id, $multiple_options_array)){
					array_push($rules_that_apply, $rule_id);
				} else {
					// try group
					if (in_array('group_'.$agent_group_id, $multiple_options_array)){
						array_push($rules_that_apply, $rule_id);
					}
				}
			}

			$final_rules_array = array_merge($all_agent_rules, $individual_rules, $group_rules, $rules_that_apply);
			$final_rules_array = array_filter(array_unique($final_rules_array));

		} else {
			// get all rules that apply to individual agents
			$all_agent_rules = get_posts([
	    		'post_type' => 'salesking_rule',
	    	  	'post_status' => 'publish',
	    	  	'numberposts' => -1,
	    	  	'fields'	=> 'ids',
	    	  	'meta_query'=> array(
	                'relation' => 'AND',
	                array(
                        'key' => 'salesking_rule_agents_who',
                        'value' => 'agent_',
                        'compare' => 'LIKE'
                    )
	            )
	    	]);

	    	$final_rules_array = $all_agent_rules;
		}

		return $final_rules_array;
	}


	function salesking_ensure_affiliate_urls_parsed(){
		// set cookie
		if (isset($_GET['regid'])){
			if(!headers_sent()){
				setcookie("salesking_registration_cookie", sanitize_text_field($_GET['regid']), time()+86400, "/");
				setcookie("salesking_affiliate_cookie", sanitize_text_field($_GET['regid']), time()+86400, "/");
			}
		} else {
			if (isset($_GET['affid'])){
				if(!headers_sent()){
					setcookie("salesking_registration_cookie", sanitize_text_field($_GET['affid']), time()+86400, "/");
					setcookie("salesking_affiliate_cookie", sanitize_text_field($_GET['affid']), time()+86400, "/");
				}
			}
		}
	}


	function salesking_rewrite_dashboard_url() {
	    $pageid = apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true);
	    $slug = get_post_field( 'post_name', $pageid );
	    
	    // Get the full permalink to extract the complete path structure
	    $permalink = get_permalink($pageid);
	    $site_url = home_url('/');
	    $relative_path = str_replace($site_url, '', $permalink);
	    $relative_path = rtrim($relative_path, '/'); // Remove trailing slash
	    
	    // Create rewrite rule using the full path
	    add_rewrite_rule(
	        '^'.$relative_path.'/([^/]*)/?([^/]*)/?',
	        'index.php?pagename='.$slug.'&dashpage=$matches[1]'.'&pagenr=$matches[2]',
	        'top'
	    );
	    
	    flush_rewrite_rules();
	    
	    // Cookie logic remains the same
	    if (isset($_GET['regid'])){
	        setcookie("salesking_registration_cookie", sanitize_text_field($_GET['regid']), time()+86400, "/");
	        setcookie("salesking_affiliate_cookie", sanitize_text_field($_GET['regid']), time()+86400, "/");
	    } else {
	        if (isset($_GET['affid'])){
	            setcookie("salesking_registration_cookie", sanitize_text_field($_GET['affid']), time()+86400, "/");
	            setcookie("salesking_affiliate_cookie", sanitize_text_field($_GET['affid']), time()+86400, "/");
	        }
	    }
	}

	public function salesking_add_query_vars_filter( $vars ) {
	  $vars[] = "closed";
	  $vars[] = "dashpage";
	  $vars[] = "pagenr";
	  $vars[] = "id";
	  $vars[] = "regid";
	  $vars[] = "affid";
	  $vars[] = "mycart";
	  $vars[] = "search";
	  return $vars;
	}

	public function salesking_template_include( $template ) {
		global $post;
		if (isset($post->ID)){
			if ( intval($post->ID) === intval(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true) ) ){
			    $template = wc_locate_template( 'salesking-dashboard-login.php' );
			}
		}
        return $template;
    }

    public function salesking_locate_template( $template ) {

        if ( 'salesking-dashboard-login.php' === basename( $template ) ) {
        	$template = trailingslashit( plugin_dir_path( __FILE__ ) ) . 'dashboard/salesking-dashboard-login.php';
        }
        return $template;

    }

    function salesking_switched_to(){
    	// check if switch cookie is set
    	if (isset($_COOKIE['salesking_switch_cookie'])){
    		$switch_to = sanitize_text_field($_COOKIE['salesking_switch_cookie']);	
    	} else {
    		$switch_to = '';
    	}
    	
    	$current_id = get_current_user_id();

    	if (!empty($switch_to) && is_user_logged_in()){
    		// show bar
			$udata = get_userdata( get_current_user_id() );
			$name = $udata->first_name.' '.$udata->last_name;

			// get agent details
			$agent = explode('_',$switch_to);
			$customer_id = intval($agent[0]);
			$agent_id = intval($agent[1]);
			$agent_registration = $agent[2];
			// check real registration in database
			$udataagent = get_userdata( $agent_id );
            $registered_date = $udataagent->user_registered;

            // if current logged in user is the one in the cookie + agent cookie checks out
            if ($current_id === $customer_id && $agent_registration === $registered_date){

            // custom css
        	if (intval(get_option('salesking_change_color_scheme_setting', 0)) === 1){
        	    // Load colors
        	    $color = get_option( 'salesking_main_dashboard_color_setting', '#854fff' );
        	    $colorhover = get_option( 'salesking_main_dashboard_hover_color_setting', '#6a29ff' );

        	    ?>

        	    <style type="text/css">
        	        #salesking_return_agent{
        	            background-color: <?php echo esc_html( $color );?> !important;
        	            border-color: <?php echo esc_html( $color );?> !important;
        	        }

        	        #salesking_return_agent:hover{
        	            background-color: <?php echo esc_html( $colorhover );?> !important;
        	            border-color: <?php echo esc_html( $colorhover );?> !important;
        	        }
        	    </style>

    		<?php
    		}
    		?>
    		<div id="salesking_agent_switched_bar">
    			<div class="salesking_bar_element">
					<?php 

					esc_html_e('You are shopping as ','salesking');
					echo apply_filters('salesking_shopping_as_customer_text', '<strong>'.esc_html($name).' ('.$udata->user_login.')'.'</strong>', $customer_id);

					?>  
				</div> 	
				<?php
				do_action('salesking_agent_switch_top_bar', $customer_id);
				?>
				<div class="salesking_bar_element">
					<button id="salesking_return_agent" value="<?php echo esc_attr($agent_id);?>"><em class="salesking_ni salesking_ni-swap"></em>&nbsp;&nbsp;&nbsp;<span><?php esc_html_e('Switch to Agent', 'salesking'); ?></span></button>
					<input type="hidden" id="salesking_return_agent_registered" value="<?php echo esc_attr($agent_registration);?>">
				</div>		
    		</div>

    		<style>
    		body {
    		  padding-top: 50px;
    		}

    		</style>
  			<?php
  			}
    	}
    }

    function get_current_agent_id(){
    	if (isset($_COOKIE['salesking_switch_cookie'])){
	    	$switch_to = sanitize_text_field($_COOKIE['salesking_switch_cookie']);
	    	if (!empty($switch_to)){
	    		$agent = explode('_',$switch_to);
	    		$agent_id = intval($agent[1]);
	    		return $agent_id;
	    	}
	    } else {
	    	if (intval(get_option( 'salesking_agents_own_orders_commission_setting', 0 )) === 1){
	    		return get_current_user_id();
	    	}
	    }
	    return false;
    }

    function get_coupon_id_by_code( $coupon_code ) {
        global $wpdb;

        // Query the database to find the coupon post by its title (coupon code)
        $coupon_id = $wpdb->get_var( $wpdb->prepare( "
            SELECT ID
            FROM $wpdb->posts
            WHERE post_title = %s
            AND post_type = 'shop_coupon'
        ", $coupon_code ) );

        return $coupon_id;
    }

    function is_agent($user_id){
    	$agent_group = get_user_meta($user_id,'salesking_group',true);
    	if ($agent_group !== 'none' && !empty($agent_group)){
    		return true;
    	} else {
    		return false;
    	}
    }

    function agent_can_edit_price_for_themselves(){

    	return apply_filters('b2bking_agents_can_change_price_self', false);
    }

    function check_user_is_agent_with_access(){
    	// check if switch cookie is set
    	if (isset($_COOKIE['salesking_switch_cookie'])){
	    	$switch_to = sanitize_text_field($_COOKIE['salesking_switch_cookie']);
	    	$current_id = get_current_user_id();

	    	if (!empty($switch_to) && is_user_logged_in()){
	    		// show bar
				$udata = get_userdata( get_current_user_id() );
				$name = $udata->first_name.' '.$udata->last_name;

				// get agent details
				$agent = explode('_',$switch_to);
				$customer_id = intval($agent[0]);
				$agent_id = intval($agent[1]);
				$agent_registration = $agent[2];
				// check real registration in database
				$udataagent = get_userdata( $agent_id );
	            $registered_date = $udataagent->user_registered;

	            // if current logged in user is the one in the cookie + agent cookie checks out
	            if ($current_id === $customer_id && $agent_registration === $registered_date){
	            	return true;
	            }
	        }
	    }
        return false;
    }

    function salesking_prevent_edit_details(){
    	// if this is an agent, switched to customer, dont allow access to my account
    	if ($this->check_user_is_agent_with_access()){
    		if (is_edit_account_page()){
    			wp_redirect (get_permalink( wc_get_page_id( 'myaccount' ) ));
    		}
    	}
    }

    function salesking_cart_link_add(){
    	// if there is an affiliate cookie, set it - unrelated to cart link add
    	if (isset($_GET['affid'])){
    		$affcookie = sanitize_text_field($_GET['affid']);	
    	} else {
    		$affcookie = '';
    	}

    	$changecookie = true;
    	
    	if (!empty($affcookie)){

    		if (apply_filters('salesking_affiliate_cookie_override', false)){
    			if (isset($_COOKIE['salesking_affiliate_cookie'])){
    				$changecookie = false;
    			}
    		}

    		$cookietime = apply_filters('salesking_affiliate_cookie_time',604800);
    		if ($changecookie){
    			setcookie("salesking_affiliate_cookie", $affcookie, time()+intval($cookietime), "/");
    		}


    	}

    	do_action('salesking_redirect_after_set_cookie');
    	if (is_cart()){
	    	// see if mycart is set via GET
	    	if (isset($_GET['mycart'])){
	    		$mycart = sanitize_text_field($_GET['mycart']);
	    	} else {
	    		$mycart = '';
	    	}
	    	
	    	if (!empty($mycart)){
	    		$cart_string = explode('-', $mycart, 2);
	    		$agentid = $cart_string[0];
	    		$cartname = $cart_string[1];

	    		// if neither empty, get the cart
	    		if (!empty($agentid) && !empty($cartname)){
	    			// get agent user ID
	    			$agent = get_users(array(
					    'meta_key'     => 'salesking_agentid',
					    'meta_value'   => $agentid,
					    'meta_compare' => '=',
					    'fields' => 'ids',
					));
					if (count($agent) === 1){
						// set cookie for affiliation
						if ($changecookie){
							$cookietime = apply_filters('salesking_affiliate_cookie_time',604800);

							setcookie("salesking_affiliate_cookie", $agentid, time()+intval($cookietime), "/");
						}
						// get agent carts
						$carts = get_user_meta($agent[0], 'salesking_agent_carts', true);
						$carts = explode('AAAENDAAA', $carts);
						foreach ($carts as $cart){
							// find the one we need to add
							$cart_string = explode('AAANAMEAAA', $cart);
							if ($cart_string[0] === $cartname || stripslashes($cart_string[0]) === stripslashes($cartname)){
								// found it
								// empty cart
								WC()->cart->empty_cart();

								// add items to cart

								// LEGACY
								/*
								$items = explode(';;;', $cart_string[1]);
								foreach ($items as $itemqty){
									$itemqty = explode(':::', $itemqty);
									if (isset($itemqty[1])){
										$qty = $itemqty[1];
										// check if have variation
										$qty = explode('+++', $qty);
										if (count($qty) === 2){
											// have variation data
											$variationdata = unserialize($qty[1]);
											$quantity = $qty[0];
											WC()->cart->add_to_cart( $itemqty[0], $quantity, $itemqty[0], $variationdata);
										} else {
											$quantity = $qty[0];
											WC()->cart->add_to_cart( $itemqty[0], $quantity);
										}
									}									
								}
								*/
								$cart_session = get_option('salesking_'.$cartname);

								// Set the session
								WC()->session->cart            = $cart_session['cart'];
								WC()->session->cart_totals     = $cart_session['cart_totals'];
								WC()->session->applied_coupons = $cart_session['applied_coupons'];

								WC()->cart->get_cart_from_session();
								WC()->cart->calculate_totals();

								// Display cart retrieved message.
								wc_add_notice( esc_html__('Cart retrieved successfully.','salesking'), 'success' );


								// redirect to cart page without the cartname
								wp_redirect( get_permalink( wc_get_page_id( 'cart' ) ) ); // redirect home.
								exit();
							}
						}
					}
	    		}
	    	}
	    }
    }


    function salesking_registration_link(){

    	$page = apply_filters( 'wpml_object_id', get_option('marketking_vendor_registration_page_setting', 12345), 'page' , true);
    	// if page is not marketking become a vendor
    	global $post;
    	if (isset($post->ID)){
    		$post_id = $post->ID;
    	} else {
    		$post_id = '';
    	}
    	if ($post_id !== intval($page)){
	    	// see if regid is set via GET
	    	if (isset($_GET['regid'])){
	    		$regid = sanitize_text_field($_GET['regid']);
	    	} else {
	    		$regid = '';

	    		if (isset($_GET['affid'])){
	    			$regid = sanitize_text_field($_GET['affid']);
	    		} 
	    	}
	    	
	    	// show the form only if enabled in setting, but hidden input is visible for everyone
	    	if (intval(get_option( 'salesking_enable_agent_id_registration_setting', 1 )) === 1){
		    	?>
		    	<p class="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide salesking_sales_agent_dropdown_registration">
		    		<label><?php echo apply_filters('salesking_sales_rep_id_text', esc_html__('Sales Representative ID (optional)','salesking'));?> <?php do_action('salesking_sales_rep_id_input_label'); ?></label>
		    		<input type="text" name="salesking_registration_link" placeholder="<?php echo apply_filters('salesking_sales_rep_id_placeholder_text', esc_attr__('Enter your sales rep ID...','salesking'));?>" value="<?php echo esc_attr($regid);?>" <?php do_action('salesking_sales_rep_id_input'); ?>>
		    	</p>
		    	<?php
		    }

		    if (intval(get_option( 'salesking_enable_agent_id_registration_dropdown_setting', 0 )) === 1 && empty($regid)){
	    	    // Get all agents
	    	    $agents = get_users(array(
	    	        'meta_key'     => 'salesking_group',
	    	        'meta_value'   => 'none',
	    	        'meta_compare' => '!=',
	    	    ));


	    	    if (apply_filters('salesking_agents_dropdown_required', false)){
	    	    	add_filter('salesking_agents_dropdown_option_value', '__return_false');
	    	    	add_action('salesking_agents_dropdown_tags', function(){
	    	    		echo 'required';
	    	    	});
	    	    }


	    	    ?>
	    	    <p class="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide salesking_sales_agent_dropdown_registration">
	    		    <label><?php esc_html_e('Choose a Sales Agent','salesking');?></label>
	    		    <select name="salesking_registration_link" <?php do_action('salesking_agents_dropdown_tags'); ?>>
	    		    	<option value="<?php echo apply_filters('salesking_agents_dropdown_option_value', 'none'); ?>">- <?php esc_html_e('None','salesking');?> -</option>
	    		        <?php foreach($agents as $user){
	    		            $user_id = $user->ID;
	    		            $agent_id = get_user_meta($user_id,'salesking_agentid', true);

	    		            if (empty($agent_id)){
	    		                $characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	    		                $agent_id = '';
	    		                for ($i = 0; $i < 10; $i++)
	    		                $agent_id .= $characters[mt_rand(0, 35)];
	    		                $agent_id = strtoupper($agent_id);
	    		                update_user_meta($user_id,'salesking_agentid', $agent_id);
	    		            }

	    		            ?>
	    		            <option value="<?php echo $agent_id; ?>"><?php echo apply_filters('salesking_dropdown_agent_display_name', $user->display_name, $user); ?></option>
	    		            <?php
	    		        }   
	    		        ?>
	    		    </select>
	    		</p>
	    	    <?php
		    }
		    do_action('salesking_after_choose_sales_agent', $regid);

		    
		    ?>
	    	<input type="hidden" name="salesking_registration_link_hidden" value="<?php echo esc_attr($regid);?>">
	    	<?php
	    }
    }

    function salesking_check_registration_errors ( $errors, $username, $email ) {


    	if (isset($_POST['salesking_registration_link'])){
    		$registration_value = sanitize_text_field($_POST['salesking_registration_link']);
    		if (!empty($registration_value)){
    			// get agent user ID
    			$agent = get_users(array(
				    'meta_key'     => 'salesking_agentid',
				    'meta_value'   => $registration_value,
				    'meta_compare' => '=',
				    'fields' => 'ids',
				));
				if (count($agent) === 1 || $registration_value === 'none'){
				
				} else {
					// throw registration error
					$errors->add( 'username_error', apply_filters('salesking_cannot_find_rep_error', esc_html__('We could not find any sales rep with the ID provided.', 'salesking')));

				}
    		}
    	}


    	return $errors;

    }

	
    function salesking_assign_agent_registration($user_id){

    	// not relevant if this is a dokan seller
    	if (isset($_POST['role'])){
    		if (sanitize_text_field($_POST['role']) === 'seller'){
    			return;
    		}
    	}

    	// check if input is set and not empty
    	$continue = 'yes';

    	//check if registration is set via B2BKing
    	// if agent already assign, skip
    	$current_agent = get_user_meta($user_id,'salesking_assigned_agent', true);
    	if ($current_agent === 'none'){
    		$continue = 'no';
    	}

    	// if user signed up to be agent, skip
    	$user_wants_to_be_agent = get_user_meta($user_id,'registration_role_agent', true);
    	if ($user_wants_to_be_agent === 'yes'){
    		$continue = 'no';

    		// set agent as part of team
    		if (isset($_POST['salesking_registration_link'])){
	    		$registration_value = sanitize_text_field($_POST['salesking_registration_link']);
	    		if (!empty($registration_value)){
	    			// get agent user ID
	    			$agent = get_users(array(
					    'meta_key'     => 'salesking_agentid',
					    'meta_value'   => $registration_value,
					    'meta_compare' => '=',
					    'fields' => 'ids',
					));
					if (count($agent) === 1){
						update_user_meta($user_id, 'salesking_parent_agent', $agent[0]);
						$parentaggroup = get_user_meta( $agent[0], 'salesking_group', true );
						update_user_meta($user_id, 'salesking_group', $parentaggroup);
					}
	    		}
	    	}
	    	if (isset($_POST['salesking_registration_link_hidden'])){
	    		$registration_value = sanitize_text_field($_POST['salesking_registration_link_hidden']);
	    		if (!empty($registration_value)){
	    			// get agent user ID
	    			$agent = get_users(array(
					    'meta_key'     => 'salesking_agentid',
					    'meta_value'   => $registration_value,
					    'meta_compare' => '=',
					    'fields' => 'ids',
					));
					if (count($agent) === 1){
						update_user_meta($user_id, 'salesking_parent_agent', $agent[0]);
						$parentaggroup = get_user_meta( $agent[0], 'salesking_group', true );
						update_user_meta($user_id, 'salesking_group', $parentaggroup);
					}
	    		}
	    	}
    	}

    	if (isset($_POST['salesking_registration_link'])){
    		$registration_value = sanitize_text_field($_POST['salesking_registration_link']);
    		if (!empty($registration_value)){
    			// get agent user ID
    			$agent = get_users(array(
				    'meta_key'     => 'salesking_agentid',
				    'meta_value'   => $registration_value,
				    'meta_compare' => '=',
				    'fields' => 'ids',
				));
				if (count($agent) === 1){
					update_user_meta($user_id,'salesking_assigned_agent', $agent[0]);
					$continue='no';

					do_action('salesking_after_user_registered_agent_link', $user_id, $agent[0]);
				} else {
					// throw registration error
				}
    		}
    	}

    	if ($continue === 'yes'){
	    	if (isset($_POST['salesking_registration_link_hidden'])){
	    		$registration_value = sanitize_text_field($_POST['salesking_registration_link_hidden']);
	    		if (!empty($registration_value)){
	    			// get agent user ID
	    			$agent = get_users(array(
					    'meta_key'     => 'salesking_agentid',
					    'meta_value'   => $registration_value,
					    'meta_compare' => '=',
					    'fields' => 'ids',
					));
					if (count($agent) === 1){
						update_user_meta($user_id,'salesking_assigned_agent', $agent[0]);
						$continue='no';
						do_action('salesking_after_user_registered_agent_link', $user_id, $agent[0]);

					}
	    		}
	    	}
    	}

    	

    	if ($continue === 'yes'){
	    	if (isset($_GET['regid']) || isset($_GET['affid'])){

	    		if (isset($_GET['regid'])){
	    			$registration_value = sanitize_text_field($_GET['regid']);
	    		} else {
	    			if (isset($_GET['affid'])){
	    				$registration_value = sanitize_text_field($_GET['affid']);
	    			}
	    		}

	    		if (!empty($registration_value)){
	    			// get agent user ID
	    			$agent = get_users(array(
					    'meta_key'     => 'salesking_agentid',
					    'meta_value'   => $registration_value,
					    'meta_compare' => '=',
					    'fields' => 'ids',
					));
					if (count($agent) === 1){
						update_user_meta($user_id,'salesking_assigned_agent', $agent[0]);
						$continue='no';
						do_action('salesking_after_user_registered_agent_link', $user_id, $agent[0]);

					}
	    		}
	    	}
    	}

    	if ($continue === 'yes'){
	    	if (isset($_COOKIE['salesking_registration_cookie'])){
	    		$registration_value = sanitize_text_field($_COOKIE['salesking_registration_cookie']);
	    		if (!empty($registration_value)){
	    			// get agent user ID
	    			$agent = get_users(array(
					    'meta_key'     => 'salesking_agentid',
					    'meta_value'   => $registration_value,
					    'meta_compare' => '=',
					    'fields' => 'ids',
					));
					if (count($agent) === 1){
						update_user_meta($user_id,'salesking_assigned_agent', $agent[0]);
						$continue='no';
						do_action('salesking_after_user_registered_agent_link', $user_id, $agent[0]);
					}
	    		}
	    	}
    	}

    	if ($continue === 'yes'){
	    	// if no value has been selected until here, let's check if setting to assign automatically is enabled or not
	    	if (intval(get_option( 'salesking_enable_random_assign_agent_setting', 0 )) === 1){
	    		$included_ids = get_users(array(
				    'meta_key'     => 'salesking_group',
				    'meta_value'   => apply_filters('salesking_exclude_assignment_registration','none'),
				    'meta_compare' => '!=',
				    'fields' => 'ids',
				));
				shuffle($included_ids);
	    		// assign user to a random agent
	    		update_user_meta($user_id,'salesking_assigned_agent', apply_filters('salesking_assign_automatically_agent_id',$included_ids[0]));
	    	}
	    }
    }

    public function set_price_in_cart( $price, $cart_item, $cart_item_key ) {

    	if ($this->check_user_is_agent_with_access() || $this->agent_can_edit_price_for_themselves()){
    		// proceed
    	} else {
    		return $price;
    	}

    	// calculate MIN / MAX values depending on allowed discount and settings
    	$can_increase_price = intval(get_option( 'salesking_agents_can_edit_prices_increase_setting', 1 ));
    	$can_decrease_price = intval(get_option( 'salesking_agents_can_edit_prices_discount_setting', 1 ));

    	// get original price 
    	if (isset($cart_item['_salesking_original_price'])){
    		$original_price = $cart_item['_salesking_original_price'];
    	} else {
    		$original_price = $cart_item['data']->get_price();
    	}

    	if ($can_increase_price !== 1){
    		// cannot increase price, therefore maximum is the original price
    		$max = $original_price;
    	} else {
    		// can increase price, there is no maixmum
    		$max = '';
    	}

    	if ($can_decrease_price !== 1){
    		// cannot decrease price, therefore minimum is the original price
    		$min = $original_price;
    	} else {
    		// can decrease price
    		// set minimum depending on allowed discount percentage for agent or agent group

    		// get agent id
    		if (isset($_COOKIE['salesking_switch_cookie'])){
		    	$switch_to = sanitize_text_field($_COOKIE['salesking_switch_cookie']);
				$agent = explode('_',$switch_to);
				$agent_id = intval($agent[1]);
    		} else {
    			$agent_id = 0;
    			if ($this->agent_can_edit_price_for_themselves()){
    				$agent_id = get_current_user_id();
    			}
    		}

			$agent_group = get_user_meta($agent_id, 'salesking_group', true);

    		// get max allowed discount
    		$allowed_discount = get_user_meta($agent_id, 'salesking_group_max_discount', true);


    		if (empty($allowed_discount) || !($allowed_discount)){
    		    $group_discount = get_post_meta($agent_group,'salesking_group_max_discount', true);
    		    $allowed_discount = $group_discount;
    		}
    		if (empty($allowed_discount) || !($allowed_discount)){
    		    $allowed_discount = 1;
    		}

    		$min = round(($original_price*(100-$allowed_discount)/100), 2);
    	}

        $attributes = apply_filters( 'salesking_cart_input', array(
            'class' => 'input-text text',
            'min'   => $min,
            'step'  => '0.01',
            'max'	=> $max,
        ), $original_price, $cart_item );

        $field = sprintf( '<input type="number" name="cart[%s][_salesking_set_price]" value="%s" %s>',
            $cart_item_key,
            $cart_item['data']->get_price(),
            implode( '', array_map( function( $key, $value ) {
                return sprintf( ' %s="%s"', $key, $value );
            }, array_keys( $attributes ), $attributes ) )
        );

        return $field;
    }

    public function retrieve_prices( $price, $object ) {
        if ( defined( 'REST_REQUEST' ) ) { return $price; }

        if ($this->check_user_is_agent_with_access() || $this->agent_can_edit_price_for_themselves()){
        	// proceed
        } else {
        	return $price;
        }

        $product_cart_id = WC()->cart->generate_cart_id( $object->get_id() );
        if ( is_array( WC()->cart->cart_contents ) && isset( WC()->cart->cart_contents[ $product_cart_id ] ) ) {
            $item = WC()->cart->cart_contents[ $product_cart_id ];
            if ( isset( $item['_salesking_set_price'] ) ) {
                return $item['_salesking_set_price'];
            }
        }
        return $price;
    }

    public function calculate_prices( $cart_object ) {
        if ( is_admin() && ! defined( 'DOING_AJAX' ) ) { return; }
        if ( did_action( 'woocommerce_before_calculate_totals' ) >= 3 ) { return; }
        if ($this->check_user_is_agent_with_access() || $this->agent_can_edit_price_for_themselves()){
        	// proceed
        } else {
        	return;
        }

        if ( is_cart() ) {

            $nonce_value = wc_get_var( $_REQUEST['woocommerce-cart-nonce'], wc_get_var( $_REQUEST['_wpnonce'], '' ) );

            if ( ( ! empty( $_POST['apply_coupon'] ) || ! empty( $_POST['update_cart'] ) || ! empty( $_POST['proceed'] ) ) && wp_verify_nonce( $nonce_value, 'woocommerce-cart' ) ) {

                $cart_updated = false;

                $cart_totals = isset( $_POST['cart'] ) ? $_POST['cart'] : '';

                if ( ! WC()->cart->is_empty() && is_array( $cart_totals ) ) {

                    foreach ( WC()->cart->get_cart() as $cart_item_key => $cart_item ) {

                        $custom_price = $cart_totals[ $cart_item_key ]['_salesking_set_price'];

                        if ( '' === $custom_price || $custom_price === $cart_item['data']->get_price() ) {
                            continue;
                        }

                        $cart_item['_salesking_set_price'] = $custom_price;
                        // set original price if not already set
                        if (!isset($cart_item['_salesking_original_price'])){
                        	$cart_item['_salesking_original_price'] = $cart_item['data']->get_price();
                        }
                        
                        $cart_item['data']->set_price( $custom_price );
                        $cart_updated = true;

                        WC()->cart->cart_contents[$cart_item_key] = $cart_item;
                    }
                }

                if ( $cart_updated ) {

                    WC()->cart->calculate_totals();
                    WC()->cart->set_session();
                    wc_add_notice( esc_html__( 'Cart updated.', 'salesking' ), 'success' );
                }
            }
        }
        if ( is_checkout() || is_cart()) {
            foreach ( WC()->cart->get_cart() as $cart_item_key => $cart_item ) {
                if ( isset( $cart_item['_salesking_set_price'] ) ) {
                    $cart_item['data']->set_price( $cart_item['_salesking_set_price'] );
                }
            }
        }
    }

    public function add_prices_to_order( $item_id, $values ) {

    	if ($this->check_user_is_agent_with_access() || $this->agent_can_edit_price_for_themselves()){

	       	if ( isset( $values->legacy_values['_salesking_set_price'] ) || isset( $values['_salesking_set_price'] ) ) {
	       	    wc_add_order_item_meta( $item_id, '_salesking_set_price', max($values->legacy_values['_salesking_set_price'], $values['_salesking_set_price']) );
	       	}
	       	if ( isset( $values->legacy_values['_salesking_original_price'] ) || isset( $values['_salesking_original_price'] ) ) {
	       	    wc_add_order_item_meta( $item_id, '_salesking_original_price', max($values->legacy_values['_salesking_original_price'], $values['_salesking_original_price']) );
	       	}
	    }
    }

	function enqueue_public_resources(){

		// scripts and styles already registered by default
		wp_enqueue_script('jquery'); 

		// the following 3 scripts enable WooCommerce Country and State selectors
		wp_enqueue_script( 'selectWoo' );
		wp_enqueue_style( 'select2' );
		wp_enqueue_script( 'wc-country-select' );

		if (apply_filters('salesking_load_datatables', true)){

			wp_enqueue_script('dataTables', plugins_url('../includes/assets/lib/dataTables/jquery.dataTables.min.js', __FILE__), $deps = array(), $ver = false, $in_footer =true);
			wp_enqueue_style( 'dataTables', plugins_url('../includes/assets/lib/dataTables/jquery.dataTables.min.css', __FILE__));
		
		}

		wp_enqueue_script('salesking_public_script', plugins_url('assets/js/public.js', __FILE__), $deps = array('dataTables'), filemtime( plugin_dir_path( __FILE__ ) . 'assets/js/public.js' ), $in_footer =true);
		wp_enqueue_style('salesking_main_style', plugins_url('../includes/assets/css/style.css', __FILE__), $deps = array(), filemtime( plugin_dir_path( __FILE__ ) . '../includes/assets/css/style.css' ));


		// Send display settings to JS
    	$data_to_be_passed = array(
    		'security'  => wp_create_nonce( 'salesking_security_nonce' ),
    		'ajaxurl' => admin_url( 'admin-ajax.php' ),
    		'carturl' => wc_get_cart_url(),
    		'currency_symbol' => get_woocommerce_currency_symbol(),
    		'dashboardurl' => trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true))),
    		'customersurl' => apply_filters('salesking_switch_back_link', trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true))).'customers'),
    		'announcementsurl' => trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true))).'announcements',
    		'favicon' => get_site_icon_url(),
    		'ischeckout' => is_checkout(),
		);


		wp_localize_script( 'salesking_public_script', 'salesking_display_settings', $data_to_be_passed );

    }

    function enqueue_dashboard_resources(){

    	// Dashboard
    	wp_enqueue_style('salesking_dashboard', plugins_url('dashboard/assets/css/dashlite.css', __FILE__), $deps = array(), filemtime( plugin_dir_path( __FILE__ ) . 'dashboard/assets/css/dashlite.css' ));
    	wp_enqueue_script('salesking_dashboard_bundle', plugins_url('dashboard/assets/js/bundle.js', __FILE__), $deps = array(), $ver = false, $in_footer =true);
    	wp_enqueue_script('salesking_dashboard_scripts', plugins_url('dashboard/assets/js/scripts.js', __FILE__), $deps = array(), $ver = false, $in_footer =true);
    	wp_enqueue_script('salesking_dashboard_chart', plugins_url('dashboard/assets/js/charts/chart-ecommerce.js', __FILE__), $deps = array(), filemtime( plugin_dir_path( __FILE__ ) . 'dashboard/assets/js/charts/chart-ecommerce.js' ), $in_footer =true);
    	wp_enqueue_script('salesking_dashboard_chart_sales', plugins_url('dashboard/assets/js/charts/chart-sales.js', __FILE__), $deps = array(), filemtime( plugin_dir_path( __FILE__ ) . 'dashboard/assets/js/charts/chart-sales.js' ), $in_footer =true);
    	wp_enqueue_script('salesking_dashboard_messages', plugins_url('dashboard/assets/js/apps/messages.js', __FILE__), $deps = array(), $ver = false, $in_footer =true);
    	wp_enqueue_script('dataTablesButtons', plugins_url('../includes/assets/lib/dataTables/dataTables.buttons.min.js', __FILE__), $deps = array(), $ver = false, $in_footer =true);
    	wp_enqueue_script('dataTablesButtonsHTML', plugins_url('../includes/assets/lib/dataTables/buttons.html5.min.js', __FILE__), $deps = array(), $ver = false, $in_footer =true);
    	wp_enqueue_script('dataTablesButtonsPrint', plugins_url('../includes/assets/lib/dataTables/buttons.print.min.js', __FILE__), $deps = array(), $ver = false, $in_footer =true);
    	wp_enqueue_script('dataTablesButtonsColvis', plugins_url('../includes/assets/lib/dataTables/buttons.colVis.min.js', __FILE__), $deps = array(), $ver = false, $in_footer =true);

    	wp_enqueue_script('jszip', plugins_url('../includes/assets/lib/dataTables/jszip.min.js', __FILE__), $deps = array(), $ver = false, $in_footer =true);
    	wp_enqueue_script('pdfmake', plugins_url('../includes/assets/lib/dataTables/pdfmake.min.js', __FILE__), $deps = array(), $ver = false, $in_footer =true);
    	wp_enqueue_script('vfsfonts', plugins_url('../includes/assets/lib/dataTables/vfs_fonts.js', __FILE__), $deps = array(), $ver = false, $in_footer =true);

    	if (defined('B2BKING_DIR') && intval(get_option('b2bking_enable_offers_setting', 1)) === 1){
    		wp_enqueue_style('b2bkingintegrationsk', plugins_url('dashboard/assets/b2bkingintegration/b2bkingintegration.css', __FILE__), $deps = array(), $ver = false);

    		wp_enqueue_script('jquerymodalzz', plugins_url('dashboard/assets/b2bkingintegration/jquerymodal/jquery.modal.min.js', __FILE__), $deps = array(), $ver = false, $in_footer =true);
    		wp_enqueue_style('jquerymodalzz', plugins_url('dashboard/assets/b2bkingintegration/jquerymodal/jquery.modal.min.css', __FILE__));
    	}
  	
   	
    	// Dashboard end

		wp_enqueue_script('salesking_public_script', plugins_url('assets/js/public.js', __FILE__), $deps = array(), filemtime( plugin_dir_path( __FILE__ ) . 'assets/js/public.js' ), $in_footer =true);
		// Send display settings to JS

    	$data_to_be_passed = array(
    		'security'  => wp_create_nonce( 'salesking_security_nonce' ),
    		'ajaxurl' => admin_url( 'admin-ajax.php' ),
    		'carturl' => wc_get_cart_url(),
    		'shopurl' => apply_filters('salesking_shop_as_customer_link',get_permalink( wc_get_page_id( 'shop' ) )),
    		'accounturl' => get_permalink( wc_get_page_id( 'myaccount' ) ),
    		'adminurl' => admin_url(''),
    		'datatables_folder' => plugins_url('../includes/assets/lib/dataTables/i18n/', __FILE__),
    		'tables_language_option' => get_option('salesking_tables_language_option_setting','English'),
    		'currency_symbol' => get_woocommerce_currency_symbol(),
    		'dashboardurl' => trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true))),
    		'customersurl' => apply_filters('salesking_switch_back_link', trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true))).'customers'),
    		'announcementsurl' => trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true))).'announcements',
    		'sure_delete_coupon' => esc_html__('Are you sure you want to delete this coupon?','salesking'),
    		'sure_create_cart' => esc_html__('Are you sure you want to save this cart?','salesking'),
    		'sure_delete_cart' => esc_html__('Are you sure you want to delete this cart?','salesking'),
    		'sure_add_customer' => esc_html__('Are you sure you want to add this customer?','salesking'),
    		'sure_add_subagent' => esc_html__('Are you sure you want to add this subagent?','salesking'),
    		'sure_save_info' => esc_html__('Are you sure you want to save the payout info?','salesking'),
    		'ready' => esc_html__('Ready','salesking'),
    		'link_copied' => esc_html__('Link copied', 'salesking'),
    		'copied' => esc_html__('Copied', 'salesking'),
    		'searchtext'  => esc_html__('Search ', 'salesking'),
    		'copy' => esc_html__('Copy', 'salesking'),
    		'copy_link' => esc_html__('Copy Link', 'salesking'),
    		'customer_created' => esc_html__('The customer account has been created. An email has been sent to the customer with account details.', 'salesking'),
    		'customer_created_error' => esc_html__('The customer account could not be created. It may be because the username or email already exists. Here are the error details:', 'salesking'),
    		'subagent_created' => esc_html__('The agent account has been created. An email has been sent to the agent with account details.', 'salesking'),
    		'subagent_created_error' => esc_html__('The agent account could not be created. It may be because the username or email already exists. Here are the error details: ', 'salesking'),
    		'print' => esc_html__('Print', 'salesking'), 
    		'edit_columns' => esc_html__('Edit Columns', 'salesking'), 
    		'completed' => esc_html__('Completed', 'salesking'),
    		'pending' => esc_html__('Pending', 'salesking'),
    		'cancelled' => esc_html__('Cancelled', 'salesking'),
    		'orders' => esc_html__('orders', 'salesking'),
    		'queryid' => sanitize_text_field(get_query_var('id')),
    		'color' => get_option( 'salesking_main_dashboard_color_setting', '#854fff' ),
    		'hovercolor' => get_option( 'salesking_main_dashboard_hover_color_setting', '#6a29ff' ),
    		'ajax_customers_table' => apply_filters('salesking_load_customers_table_ajax', false) ? 1 : 0,
    		'ajax_orders_table' => apply_filters('salesking_load_orders_table_ajax', false) ? 1 : 0,
    		'pdf_download_lang' => apply_filters('salesking_pdf_downloads_language', 'english'),
    		'pdf_download_font' => apply_filters('salesking_pdf_downloads_font', 'Roboto'),
    		'coupon_created' => esc_html__('Coupon created successfully.','salesking'),
    		'are_you_sure_save_offer' => esc_html__('Are you sure you want to publish this offer?', 'salesking'),
    		'are_you_sure_delete_offer' => esc_html__('Are you sure you want to delete this offer?', 'salesking'),
    		'offer_must_have_title' => esc_html__('You must enter a title for the offer!', 'salesking'),
    		'offer_must_have_product' => esc_html__('You must have at least 1 product with quantity and price!', 'salesking'),
    		'offers_link'	=> trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true))).'offers-b2b',
    		'email_offer'	=> esc_html__('Email Offer', 'salesking'),
    		'email_offer_confirm' => esc_html__('This offer will be emailed to ALL users that have visibility. Make sure to save the offer first if you made changes to it! Are you sure you want to proceed?', 'salesking'),
    		'email_has_been_sent' => esc_html__('The offer has been emailed successfully.', 'salesking'),
    		'offers_endpoint_link' => apply_filters('b2bking_offers_link', get_permalink( get_option('woocommerce_myaccount_page_id') ).get_option('b2bking_offers_endpoint_setting','offers')),
    		'also_email_offer'	=> esc_html__('The offer has been saved. Do you want to also email it to the user?', 'salesking'),
    		'text_delete' => esc_html__('X', 'salesking'),

		);

		$completed = 0;
		$pending = 0;
		$cancelled = 0; 

		// statistics about orders for dashboard page
		if (empty(get_query_var('dashpage'))){ 
			// if earnings enabled,

			if (intval(get_option( 'salesking_enable_earnings_setting', 1 )) === 1){

				$earnings = get_posts( array( 
				    'post_type' => 'salesking_earning',
				    'numberposts' => -1,
				    'post_status'    => 'any',
				    'date_query' => array(
				            'after' => date('Y-m-d', strtotime('-30 days')) 
				        ),
				    'fields'    => 'ids',
				    'meta_key'   => 'agent_id',
				    'meta_value' => get_current_user_id(),
				));

				foreach ($earnings as $earning_id){
				    $order_id = get_post_meta($earning_id,'order_id', true);
				    $orderobj = wc_get_order($order_id);
				    if ($orderobj !== false){
					    $status = $orderobj->get_status();
					    // check if approved
					    if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
					        $completed++;
					    } else if ($status === 'processing'){
					    	$pending++;
					    } else if ($status === 'on-hold'){
					    	$pending++;
					    } else if ($status === 'pending'){
					    	$pending++;
					    } else if ($status === 'failed'){
					    	$cancelled++;
					    } else if ($status === 'cancelled'){
					    	$cancelled++;
					    } else if ($status === 'refunded'){
					    	$cancelled++;
					    }
					}
				}

				// also get all earnings where this agent is parent
				$earnings = get_posts( array( 
				    'post_type' => 'salesking_earning',
				    'numberposts' => -1,
				    'post_status'    => 'any',
				    'date_query' => array(
				            'after' => date('Y-m-d', strtotime('-30 days')) 
				        ),
				    'fields'    => 'ids',
				    'meta_key'   => 'parent_agent_id_'.get_current_user_id(),
				    'meta_value' => get_current_user_id(),
				));

				foreach ($earnings as $earning_id){
				    $order_id = get_post_meta($earning_id,'order_id', true);
				    $orderobj = wc_get_order($order_id);
				    if ($orderobj !== false){
					    $status = $orderobj->get_status();
					    // check if approved
					    if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
					        $completed++;
					    } else if ($status === 'processing'){
					    	$pending++;
					    } else if ($status === 'on-hold'){
					    	$pending++;
					    } else if ($status === 'pending'){
					    	$pending++;
					    } else if ($status === 'failed'){
					    	$cancelled++;
					    } else if ($status === 'cancelled'){
					    	$cancelled++;
					    } else if ($status === 'refunded'){
					    	$cancelled++;
					    }
					}
				}
			} else { // else show orders

				$args = array(
				    'limit' => -1,
				    'type' => 'shop_order',
				    'meta_key'      => 'salesking_assigned_agent', // Postmeta key field
				    'meta_value'    => get_current_user_id(), // Postmeta value field
				    'meta_compare'  => '=', // P
				);
				$agent_orders = wc_get_orders( $args );

				foreach ($agent_orders as $order){
				    $orderobj = $order;
				    if ($orderobj !== false){
					    $status = $orderobj->get_status();
					    // check if approved
					    if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
					        $completed++;
					    } else if ($status === 'processing'){
					    	$pending++;
					    } else if ($status === 'on-hold'){
					    	$pending++;
					    } else if ($status === 'pending'){
					    	$pending++;
					    } else if ($status === 'failed'){
					    	$cancelled++;
					    } else if ($status === 'cancelled'){
					    	$cancelled++;
					    } else if ($status === 'refunded'){
					    	$cancelled++;
					    }
					}
				}

			}

			$data_to_be_passed['completedorders'] = $completed;
			$data_to_be_passed['pendingorders'] = $pending;
			$data_to_be_passed['cancelledorders'] = $cancelled;

		}

		// include earnings for js, if this is earnings page or empty = dashboard
		if (get_query_var('dashpage') === 'earnings' || empty(get_query_var('dashpage'))){ 

			// get month requested
			$months_removed = sanitize_text_field(get_query_var('id'));
			if (empty($months_removed)){
				$months_removed = 0;
			}
			$month_number = date('n', strtotime('-'.$months_removed.' months'));
			$month_year = date('Y', strtotime('-'.$months_removed.' months'));
			$days_number = date('t', mktime(0, 0, 0, $month_number, 1, $month_year)); 

			$days_array = array();

			// get labels (days in month)
			while ($days_number > 0){
				array_push($days_array, $days_number);
				$days_number--;
			}

			//let's query the database only once for the month earnings
			$earnings_array = array("1"=>0, "2"=>0, "3"=>0, "4"=>0, "5"=>0, "6"=>0, "7"=>0, "8"=>0, "9"=>0, "10"=>0, "11"=>0, "12"=>0, "13"=>0, "14"=>0, "15"=>0, "16"=>0, "17"=>0, "18"=>0, "19"=>0, "20"=>0, "21"=>0, "22"=>0, "23"=>0, "24"=>0, "25"=>0, "26"=>0, "27"=>0, "28"=>0, "29"=>0, "30"=>0, "31"=>0);

			
			$earnings = get_posts( array( 
			    'post_type' => 'salesking_earning',
			    'numberposts' => -1,
			    'post_status'    => 'any',
		    	'date_query' => array(
		            'year'  => $month_year,
		            'month' => $month_number,
		        ),
			    'meta_key'   => 'agent_id',
			    'meta_value' => get_current_user_id(),
			));
			foreach ($earnings as $earning){
				$earnings_number = 0;
				$date = date("d", strtotime($earning->post_date));
			    $order_id = get_post_meta($earning->ID,'order_id', true);
			    $orderobj = wc_get_order($order_id);
			    if ($orderobj !== false){
			    	$status = $orderobj->get_status();
			    	$earnings_total = get_post_meta($earning->ID,'salesking_commission_total', true);
			    	// check if approved
			    	if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
			    	    $earnings_number+=$earnings_total;
			    	}
			    	$earnings_array[intval($date)] += $earnings_number;
			    }
			    
			}

			$earnings = get_posts( array( 
			    'post_type' => 'salesking_earning',
			    'numberposts' => -1,
			    'post_status'    => 'any',
		    	'date_query' => array(
		            'year'  => $month_year,
		            'month' => $month_number,
		        ),
			    'meta_key'   => 'parent_agent_id_'.get_current_user_id(),
                'meta_value' => get_current_user_id(),
			));
			foreach ($earnings as $earning){
				$earnings_number = 0;
				$date = date("d", strtotime($earning->post_date));
			    $order_id = get_post_meta($earning->ID,'order_id', true);
			    $orderobj = wc_get_order($order_id);
			    if ($orderobj !== false){
				    $status = $orderobj->get_status();
				    $earnings_total = get_post_meta($earning->ID,'parent_agent_id_'.get_current_user_id().'_earnings', true);
				    // check if approved
				    if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
				        $earnings_number+=$earnings_total;
				    }
				    $earnings_array[intval($date)] += $earnings_number;
				}
			}


			$data_to_be_passed['earningslabels'] = array_reverse($days_array);

			// round to 2
			$earnings_array = array_map(function($v){return round($v,2);}, $earnings_array);

			$data_to_be_passed['earningsvalues'] = array_values($earnings_array);
		}

		
		$all_countries = WC()->countries->get_allowed_country_states();

		// Filter out countries with empty state arrays
		$countries_with_states = array();
		foreach ($all_countries as $country_code => $states) {
		    // Only include countries that have states (non-empty array)
		    if (!empty($states) && is_array($states) && count($states) > 0) {
		        $countries_with_states[$country_code] = $states;
		    }
		}

		$data_to_be_passed['country_params'] = array(
		    'countries' => $countries_with_states,
		    'i18n_select_state_text' => esc_attr__('Select an option…', 'woocommerce'),
		);

		wp_localize_script( 'salesking_public_script', 'salesking_display_settings', $data_to_be_passed );
		wp_localize_script( 'salesking_dashboard_scripts', 'salesking_display_settings', $data_to_be_passed );		


		wp_localize_script( 'salesking_public_script', 'salesking_display_settings', $data_to_be_passed );
		wp_localize_script( 'salesking_dashboard_scripts', 'salesking_display_settings', $data_to_be_passed );

    }
    	
}

