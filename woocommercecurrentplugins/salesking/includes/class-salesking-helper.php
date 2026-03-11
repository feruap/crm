<?php

class Salesking_Helper{

	public static function get_earnings($agent_id,$timeframe, $days = false, $months = false, $years = false, $admin_earnings = false, $from = false, $to = false, $reports = false){

		$earnings_number = 0;
		$earningsparent = array();

		if ($reports === true){
			// organize info by day, month, year to be able to display the charts
			$timestamps_commissions = array();
		}

		if ($admin_earnings === false){

			// specific agent
			if ($timeframe === 'fromto' && $agent_id !== 'allagents'){

				$earnings_number = 0;
				$earnings = get_posts( array( 
				    'post_type' => 'salesking_earning',
				    'numberposts' => -1,
				    'post_status'    => 'any',
				    'date_query' => array(
				            'after' => $from, 
				            'before' => $to 
				        ),
				    'fields'    => 'ids',
				    'meta_key'   => 'agent_id',
				    'meta_value' => $agent_id,
				));

				// also get all earnings where this agent is parent
        		$earningsparent = get_posts( array( 
        		    'post_type' => 'salesking_earning',
        		    'numberposts' => -1,
        		    'post_status'    => 'any',
        		    'fields'    => 'ids',
        		    'date_query' => array(
        		            'after' => $from, 
        		            'before' => $to 
        		        ),
        		    'meta_key'   => 'parent_agent_id_'.$agent_id,
        		    'meta_value' => $agent_id,
        		));

			}
			if ($timeframe === 'fromto' && $agent_id === 'allagents'){

				$earnings_number = 0;
				$earnings = get_posts( array( 
				    'post_type' => 'salesking_earning',
				    'numberposts' => -1,
				    'post_status'    => 'any',
				    'date_query' => array(
				            'after' => $from, 
				            'before' => $to 
				        ),
				    'fields'    => 'ids',
				));

			}
			///
			if ($timeframe === 'current_month'){
				$site_time = time()+(get_option('gmt_offset')*3600);
				$current_day = date_i18n( 'd', $site_time );

				$earnings_number = 0;
				$earnings = get_posts( array( 
				    'post_type' => 'salesking_earning',
				    'numberposts' => -1,
				    'post_status'    => 'any',
				    'date_query' => array(
				            'after' => date('Y-m-d', strtotime('-'.$current_day.' days')) 
				        ),
				    'fields'    => 'ids',
				    'meta_key'   => 'agent_id',
				    'meta_value' => $agent_id,
				));

			}


			if ($timeframe === 'last_days'){
				if ($days!== false){
					$earnings_number = 0;
					$earnings = get_posts( array( 
					    'post_type' => 'salesking_earning',
					    'numberposts' => -1,
					    'post_status'    => 'any',
					    'date_query' => array(
					            'after' => date('Y-m-d', strtotime('-'.$days.' days')) 
					        ),
					    'fields'    => 'ids',
					    'meta_key'   => 'agent_id',
					    'meta_value' => $agent_id,
					));

				}
			}

			if ($timeframe === 'by_month'){
				if ($months!== false && $years !== false){
					$earnings_number = 0;

					// get the total month earnings
					$earnings = get_posts( array( 
					    'post_type' => 'salesking_earning',
					    'numberposts' => -1,
					    'post_status'    => 'any',
					    'date_query' => array(
					        'year'  => $years, // month year
					        'month' => $months, // month number
					    ),
					    'meta_key'   => 'agent_id',
					    'fields'	=> 'ids',
					    'meta_value' => get_current_user_id(),
					));

				}
			}

			foreach ($earnings as $earning_id){
			    $order_id = get_post_meta($earning_id,'order_id', true);
			    $orderobj = wc_get_order($order_id);
			    $main_agent = get_post_meta($earning_id, 'agent_id', true);
			    if ($orderobj !== false){
			        $status = $orderobj->get_status();
			        $earnings_total = get_post_meta($earning_id,'salesking_commission_total', true);
			        if (empty($earnings_total)){
			        	$earnings_total = 0;
			        }
			        // check if approved
			        if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
			            $earnings_number+=$earnings_total;

			            if ($reports === true){
			            	$date = $orderobj->get_date_created()->getTimestamp()+(get_option('gmt_offset')*3600);
			            	if (!isset($timestamps_commissions[$date])){
			            		$timestamps_commissions[$date] = $earnings_total;
			            	} else {
			            		$timestamps_commissions[$date] += $earnings_total;
			            	}
			            }
			        }

			        if ($agent_id === 'allagents'){
			        	$agents_of_earning = get_post_meta($earning_id, 'agents_of_earning', true);

			        	if (empty($agents_of_earning)){
			        		$agents_of_earning = array();
			        	}
			        	foreach ($agents_of_earning as $agent_of_earning){
			        		if (intval($agent_of_earning) !== intval($main_agent)){
			        			$earnings_total = get_post_meta($earning_id,'parent_agent_id_'.$agent_of_earning.'_earnings', true);
			        			if (empty($earnings_total)){
			        				$earnings_total = 0;
			        			}

			        			if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
			        			    $earnings_number+=$earnings_total;

			        			    if ($reports === true){
			        			    	$date = $orderobj->get_date_created()->getTimestamp()+(get_option('gmt_offset')*3600);
			        			    	if (!isset($timestamps_commissions[$date])){
			        			    		$timestamps_commissions[$date] = $earnings_total;
			        			    	} else {
			        			    		$timestamps_commissions[$date] += $earnings_total;
			        			    	}
			        			    }
			        			}
			        		}
			        	}
			        }
			    }
			}

			foreach ($earningsparent as $earning_id){
    		    $order_id = get_post_meta($earning_id,'order_id', true);
    		    $orderobj = wc_get_order($order_id);
    		    if ($orderobj !== false){
        		    $status = $orderobj->get_status();
        		    $earnings_total = get_post_meta($earning_id,'parent_agent_id_'.$agent_id.'_earnings', true);
        		    if (empty($earnings_total)){
        		    	$earnings_total = 0;
        		    }
        		    // check if approved
        		    if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
        		        $earnings_number+=$earnings_total;

        		        if ($reports === true){
        		        	$date = $orderobj->get_date_created()->getTimestamp()+(get_option('gmt_offset')*3600);
        		        	if (!isset($timestamps_commissions[$date])){
        		        		$timestamps_commissions[$date] = $earnings_total;
        		        	} else {
        		        		$timestamps_commissions[$date] += $earnings_total;
        		        	}
        		        }
        		    }
        		}
    		}

			if ($reports === true){
				return $earnings_number.'***'.serialize($timestamps_commissions);
			}
			return $earnings_number;

		} else if ($admin_earnings === true){
			// admin earnings
			if ($agent_id === 'allagents'){
				if ($timeframe === 'last_days'){

					$earnings_number = 0;
					$earnings = get_posts( array( 
					    'post_type' => 'salesking_earning',
					    'numberposts' => -1,
					    'post_status'    => 'any',
					    'date_query' => array(
					            'after' => date('Y-m-d', strtotime('-'.$days.' days')) 
					        ),
					    'fields'    => 'ids',
					));

				}
				if ($timeframe === 'fromto'){

					$earnings_number = 0;
					$earnings = get_posts( array( 
					    'post_type' => 'salesking_earning',
					    'numberposts' => -1,
					    'post_status'    => 'any',
					    'date_query' => array(
					            'after' => $from, 
					            'before' => $to 
					        ),
					    'fields'    => 'ids',
					));

				}

			} else {
				// specific agent
				if ($timeframe === 'fromto'){

					$earnings_number = 0;
					$earnings = get_posts( array( 
					    'post_type' => 'salesking_earning',
					    'numberposts' => -1,
					    'post_status'    => 'any',
					    'date_query' => array(
					            'after' => $from, 
					            'before' => $to 
					        ),
					    'fields'    => 'ids',
					    'meta_key'   => 'agent_id',
					    'meta_value' => $agent_id,
					));

				}


			}

			foreach ($earnings as $earning_id){
			    $order_id = get_post_meta($earning_id,'order_id', true);
			    $orderobj = wc_get_order($order_id);
			    if ($orderobj !== false){
			    	$order_total = $orderobj->get_total();
			        $agent_earnings = get_post_meta($earning_id,'salesking_commission_total', true);
			        
			        $admin_earnings = $order_total-$agent_earnings;
			        $earnings_number+=$admin_earnings;

			        if ($reports === true){
			        	$date = $orderobj->get_date_created()->getTimestamp()+(get_option('gmt_offset')*3600);
			        	$timestamps_commissions[$date] = $admin_earnings;
			        }
			    }
			}

			if ($reports === true){
				return $earnings_number.'***'.serialize($timestamps_commissions);
			}
			return $earnings_number;
		}



		// if something went wrong
		return 0;
	}

	function get_multicurrency_price( $order_id, $price = false ) {

		if ( ! apply_filters('salesking_use_woocs_currency', true)){
			return $price;
		}

		if (!defined('WOOCS_VERSION') && !defined('WOOMULTI_CURRENCY_F_DIR') && !defined('WOOMULTI_CURRENCY_DIR')) {
			return $price;
		}

	    $order = wc_get_order( $order_id );
	    if ( ! $order ) {
	        return $price;
	    }

	    if (empty($price) || !$price){
	    	return $price;
	    }

	    if(defined('WOOCS_VERSION')){

			global $WOOCS;
			$currrent = $order->get_currency();
			if ($currrent != $WOOCS->default_currency) {
				$currencies = $WOOCS->get_currencies();
				$rate = $currencies[$currrent]['rate'];
				$default_rate = $currencies[$WOOCS->default_currency]['rate'];

				$price = floatval($price) / $rate * $default_rate;
			}
		}
		if (defined('WOOMULTI_CURRENCY_F_DIR') || defined('WOOMULTI_CURRENCY_DIR')){

			if (defined('WOOMULTI_CURRENCY_F_DIR')){
				$curcy_settings = WOOMULTI_CURRENCY_F_Data::get_ins();
			}
			if (defined('WOOMULTI_CURRENCY_DIR')){
				$curcy_settings = WOOMULTI_CURRENCY_Data::get_ins();
			}

			$current_currency = $order->get_currency();

			$default_currency = $curcy_settings->get_default_currency();

			if ($current_currency != $default_currency) {

				$rate = wmc_get_price( 1, $current_currency );
				$default_rate = wmc_get_price( 1, $default_currency );
				
				$price = floatval($price) / $rate * $default_rate;
			}
			
		}
	    
	    return floatval($price);
	}

	// takes rule IDs array. If any of them has priority, it returns array of highest priority rules
	// if none has priority, it returns all rules
	public static function get_rules_apply_priority($rules){

		// apply general rules filter, here you can remove specific rules by ID
		$rules = apply_filters('salesking_applied_rules', $rules);

		$priority_used = 0;
		$have_priority = 'no';

		foreach ($rules as $rule_id){
			$priority = intval(get_post_meta($rule_id,'salesking_standard_rule_priority', true));
			if (!empty($priority)){
				if (intval($priority) !== 0){
					$have_priority = 'yes';
					if ($priority > $priority_used){
						$priority_used = $priority;
					}
				}
			}
		}

		if ($have_priority === 'no'){
			return $rules;
		} else {
			// continue to sort and get the rules with the highest priority.
			foreach ($rules as $index => $rule_id){
				$priority = intval(get_post_meta($rule_id,'salesking_standard_rule_priority', true));

				if ($priority !== $priority_used){
					// remove rule
					unset($rules[$index]);
				}
			}

			return $rules;
		}
	}

	public static function agent_can_add_more_customers($user_id){
		$max_number_customers = apply_filters('salesking_max_number_customers', 99999999999);

		$user_ids_assigned = get_users(array(
            'meta_key'     => 'salesking_assigned_agent',
            'meta_value'   => $user_id,
            'meta_compare' => '=',
            'fields' => 'ids',
        ));

		$current_number_customers = count($user_ids_assigned);

		if ($max_number_customers <= $current_number_customers){
			return false;
		}
		
		return true;
	}

	public static function get_agent_earnings( $agent_id ) {

		// get total agent commissions
		$earnings = get_posts( array( 
		    'post_type' => 'salesking_earning',
		    'numberposts' => -1,
		    'post_status'    => 'any',
		    'fields'    => 'ids',
		    'meta_key'   => 'agent_id',
		    'meta_value' => $agent_id,
		));

		$total_agent_commissions = 0;

		foreach ($earnings as $earning_id){
		    $order_id = get_post_meta($earning_id,'order_id', true);
		    $orderobj = wc_get_order($order_id);
		    if ($orderobj !== false){
			    $earnings_total = get_post_meta($earning_id,'salesking_commission_total', true);
			    if (!empty($earnings_total) && floatval($earnings_total) !== 0){
			        $status = $orderobj->get_status();
			        if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
			        	$total_agent_commissions+=$earnings_total;
			        }
			    }
			}
		}

		return $total_agent_commissions;
	}

	public static function get_total_subagent_commission($subagent_id){
		// get all commission on subagent earnings earned by parent account
		$total_subagent_commission = 0;
		// if user is indeed a subagent (has a parent)
		$parent_agent = get_user_meta($subagent_id,'salesking_parent_agent', true);
		if (!empty($parent_agent)){
			// for every subagent earning, check if there's also an associated parent earning
			$earnings = get_posts( array( 
			    'post_type' => 'salesking_earning',
			    'numberposts' => -1,
			    'post_status'    => 'any',
			    'fields'    => 'ids',
			    'meta_key'   => 'agent_id',
			    'meta_value' => $subagent_id,
			));

			foreach ($earnings as $earning_id){
			    $order_id = get_post_meta($earning_id,'order_id', true);
			    $orderobj = wc_get_order($order_id);
			    if ($orderobj !== false){
				    $parent_earnings_total = get_post_meta($earning_id,'parent_agent_id_'.$parent_agent.'_earnings', true);
				    if (!empty($parent_earnings_total) && intval($parent_earnings_total) !== 0){
				        $status = $orderobj->get_status();
				        if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
				        	$total_subagent_commission+=$parent_earnings_total;
				        }
				    }
				}
			}
		}

		return $total_subagent_commission;
	}

	// delete all data related to earnings and payouts
	public static function reset_earnings_data(){
		$earnings = get_posts( array( 
		    'post_type' => 'salesking_earning',
		    'numberposts' => -1,
		    'post_status'    => 'any',
		    'fields'    => 'ids',
		));

		foreach ($earnings as $earning){
			wp_delete_post($earning);
		}

		$agents = get_users(array(
		    'meta_key'     => 'salesking_group',
		    'meta_value'   => 'none',
		    'meta_compare' => '!=',
		    'fields' => 'ids',
		));

		foreach ($agents as $agent){
			delete_user_meta($agent,'salesking_user_payout_history');
			delete_user_meta($agent,'salesking_outstanding_earnings');
			delete_user_meta($agent,'salesking_user_balance_history');
		}
	}

	// 'all'for all users, OR a user ID for a specific user
	public static function recalculate_agent_earnings($who){

		if ($who === 'all'){
			// get all agents
			$agents = get_users(array(
			    'meta_key'     => 'salesking_group',
			    'meta_value'   => 'none',
			    'meta_compare' => '!=',
			    'fields' => 'ids',
			));
		} else {
			// who is a user ID
			$agents = array(intval($who));
		}
	    
	    foreach ($agents as $agent){
	        $earnings = get_posts( array( 
	            'post_type' => 'salesking_earning',
	            'numberposts' => -1,
	            'post_status'    => 'any',
	            'fields'    => 'ids',
	            'meta_key'   => 'agent_id',
	            'meta_value' => $agent,
	        ));
	        $total_agent_commissions = 0;
	        foreach ($earnings as $earning_id){
	            $order_id = get_post_meta($earning_id,'order_id', true);
	            $orderobj = wc_get_order($order_id);
	            if ($orderobj !== false){
	                $earnings_total = get_post_meta($earning_id,'salesking_commission_total', true);
	                if (!empty($earnings_total) && floatval($earnings_total) !== 0){
	                    $status = $orderobj->get_status();
	                    if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
	                        $total_agent_commissions+=$earnings_total;
	                    }
	                }
	            }
	        }

	        // also get all earnings where this agent is parent
    		$earnings = get_posts( array( 
    		    'post_type' => 'salesking_earning',
    		    'numberposts' => -1,
    		    'post_status'    => 'any',
    		    'fields'    => 'ids',
    		    'meta_key'   => 'parent_agent_id_'.$agent,
    		    'meta_value' => $agent,
    		));

    		foreach ($earnings as $earning_id){
    		    $order_id = get_post_meta($earning_id,'order_id', true);
    		    $orderobj = wc_get_order($order_id);
    		    if ($orderobj !== false){
        		    $status = $orderobj->get_status();
        		    $earnings_total = get_post_meta($earning_id,'parent_agent_id_'.$agent.'_earnings', true);
        		    // check if approved
        		    if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
        		        $total_agent_commissions+=$earnings_total;
        		    }
        		}
    		}
	        
	        // also take into account all payments
	        $user_payout_history = sanitize_text_field(get_user_meta($agent,'salesking_user_payout_history', true));

	        if ($user_payout_history){
	            $transactions = explode(';', $user_payout_history);
	            $transactions = array_filter($transactions);
	        } else {
	            // empty, no transactions
	            $transactions = array();
	        }
	        $transactions = array_reverse($transactions);
	        foreach ($transactions as $transaction){
	            $elements = explode(':', $transaction);
	            $date = $elements[0];
	            $amount = $elements[1];
	            $oustanding_balance = $elements[2];
	            $note = $elements[3];
	            $method = $elements[4];
	            
	            // substract the amount paid from the commission
	            $total_agent_commissions -= $amount;
	        }

	        // user balance history update
	        $old_balance = get_user_meta($agent,'salesking_outstanding_earnings', true);
	        $new_balance = $total_agent_commissions;
	        $amount = 'RECALCULATION';
	        $date = date_i18n( 'Y/m/d', time()+(get_option('gmt_offset')*3600) ); 
	        $note = 'RECALCULATION';
	        $user_balance_history = sanitize_text_field(get_user_meta($agent,'salesking_user_balance_history', true));
	        $new_entry = $date.':'.$amount.':'.$old_balance.':'.$new_balance.':'.$note;
	        update_user_meta($agent,'salesking_user_balance_history', $user_balance_history.';'.$new_entry);


	        update_user_meta($agent,'salesking_outstanding_earnings', $total_agent_commissions);
	    }
	}

	public static function get_total_orders_value_agent($user_id){
		$total_orders_amount = $total_agent_commissions = 0;
		// get total orders amount

		// get total agent commissions
		$earnings = get_posts( array( 
		    'post_type' => 'salesking_earning',
		    'numberposts' => -1,
		    'post_status'    => 'any',
		    'fields'    => 'ids',
		    'meta_key'   => 'agent_id',
		    'meta_value' => $user_id,
		));

		foreach ($earnings as $earning_id){
		    $order_id = get_post_meta($earning_id,'order_id', true);
		    $orderobj = wc_get_order($order_id);
		    if ($orderobj !== false){
			    $earnings_total = get_post_meta($earning_id,'salesking_commission_total', true);
			    if (!empty($earnings_total) && floatval($earnings_total) !== 0){
			        $status = $orderobj->get_status();
			        $order_total = apply_filters('salesking_earnings_order_value_total',$orderobj->get_total(), $orderobj);
			        if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
			        	$total_agent_commissions+=$earnings_total;
			        	$total_orders_amount += $order_total;
			        }
			    }
			}
		}

		$site_time = time()+(get_option('gmt_offset')*3600);
		$current_day = date_i18n( 'd', $site_time );

		// also get all earnings where this agent is parent
		$earnings = get_posts( array( 
		    'post_type' => 'salesking_earning',
		    'numberposts' => -1,
		    'post_status'    => 'any',
		    'fields'    => 'ids',
		    'meta_key'   => 'parent_agent_id_'.$user_id,
		    'meta_value' => $user_id,
		));

		foreach ($earnings as $earning_id){
		    $order_id = get_post_meta($earning_id,'order_id', true);
		    $orderobj = wc_get_order($order_id);
		    if ($orderobj !== false){
			    $status = $orderobj->get_status();
			    $earnings_total = get_post_meta($earning_id,'parent_agent_id_'.$user_id.'_earnings', true);
			    // check if approved
			    if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
			        $total_agent_commissions+=$earnings_total;
			    }
			}
		}

		return $total_orders_amount;

	}

}