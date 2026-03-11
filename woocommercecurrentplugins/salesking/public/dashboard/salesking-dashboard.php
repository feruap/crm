<body class="nk-body bg-lighter npc-general has-sidebar ">
    <div class="nk-app-root">
        <!-- main @s -->
        <div class="nk-main ">
            <!-- sidebar @s -->
            <?php

            // set locale
            $locale = get_locale();
            setlocale(LC_ALL,$locale);
            // get announcements here as the unread number has to be shown in sidebar
            
            // get all announcements that the user has access (visibility) to
            $user_id = get_current_user_id();
            $user = get_user_by('id', $user_id) -> user_login;
            $agent_group = get_user_meta($user_id, 'salesking_group', true);
            $announcements = get_posts(array( 'post_type' => 'salesking_announce',
                      'post_status'=>'publish',
                      'numberposts' => -1,
                      'meta_query'=> array(
                            'relation' => 'OR',
                            array(
                                'key' => 'salesking_group_'.$agent_group,
                                'value' => '1',
                            ),
                            array(
                                'key' => 'salesking_user_'.$user, 
                                'value' => '1',
                            ),
                        )));



            // check how many are unread
            $unread_ann = 0;
            foreach ($announcements as $announcement){
                $read_status = get_user_meta($user_id,'salesking_announce_read_'.$announcement->ID, true);
                if (!$read_status || empty($read_status)){
                    $unread_ann++;
                }
                
            }

            // get all messages that are unread (unread = user is different than msg author + read time is lower than last marked time)
            // get and display messages
            $currentuser = wp_get_current_user();
            $user_id = get_current_user_id();
            $currentuserlogin = $currentuser -> user_login;
            
            // Get SalesKing messages
            $salesking_messages = get_posts(
                        array( 
                            'post_type' => 'salesking_message', // only conversations
                            'post_status' => 'publish',
                            'numberposts' => -1,
                            'fields' => 'ids',
                            'meta_query'=> array(   // only the specific user's conversations
                                'relation' => 'OR',
                                array(
                                    'key' => 'salesking_message_user',
                                    'value' => $currentuserlogin, 
                                ),
                                array(
                                    'key' => 'salesking_message_message_1_author',
                                    'value' => $currentuserlogin, 
                                )


                            )
                        )
                    );
            
            // Get B2BKing messages from customers assigned to this agent
            $b2bking_messages = array();
            if (defined('B2BKING_DIR') || defined('B2BKINGCORE_DIR')) {
                // Get all customers assigned to this agent
                $assigned_customers = array();
                
                // Get customers directly assigned to this agent
                $direct_customers = get_users(array(
                    'meta_key'     => 'salesking_assigned_agent',
                    'meta_value'   => $user_id,
                    'meta_compare' => '=',
                    'fields' => 'ids',
                ));
                $assigned_customers = array_merge($assigned_customers, $direct_customers);

                // Get customers assigned via B2BKing groups
                $groups_with_agent = get_posts(array( 
                    'post_type' => 'b2bking_group',
                    'post_status'=>'publish',
                    'numberposts' => -1,
                    'fields' => 'ids',
                    'meta_query'=> array(
                        'relation' => 'OR',
                        array(
                            'key' => 'salesking_assigned_agent',
                            'value' => $user_id,
                            'compare' => '=',
                        ),
                    )
                ));
                
                if (!empty($groups_with_agent)) {
                    $group_customers = get_users(array(
                        'meta_key'     => 'b2bking_customergroup',
                        'meta_value'   => $groups_with_agent,
                        'meta_compare' => 'IN',
                        'fields' => 'ids',
                    ));
                    
                    // Filter out customers who have a different individual agent assigned
                    foreach ($group_customers as $key => $customer_id) {
                        $individual_agent = get_user_meta($customer_id, 'salesking_assigned_agent', true);
                        if (!empty($individual_agent) && $individual_agent !== $user_id && $individual_agent !== 'none') {
                            unset($group_customers[$key]);
                        }
                    }
                    
                    $assigned_customers = array_merge($assigned_customers, $group_customers);
                }
                
                // Remove duplicates
                $assigned_customers = array_unique($assigned_customers);
                
                // Get B2BKing conversations from these customers
                if (!empty($assigned_customers)) {
                    // Convert user IDs to usernames since b2bking_conversation_user stores usernames
                    $assigned_customer_usernames = array();
                    foreach ($assigned_customers as $customer_id) {
                        $user = get_user_by('id', $customer_id);
                        if ($user) {
                            $assigned_customer_usernames[] = $user->user_login;
                        }
                    }
                    
                    if (!empty($assigned_customer_usernames)) {
                        $b2bking_messages = get_posts(array(
                            'post_type' => 'b2bking_conversation',
                            'post_status' => 'publish',
                            'numberposts' => -1,
                            'fields' => 'ids',
                            'meta_query' => array(
                                array(
                                    'key' => 'b2bking_conversation_user',
                                    'value' => $assigned_customer_usernames,
                                    'compare' => 'IN',
                                )
                            )
                        ));
                    }
                }
            }
            
            // Combine both message arrays
            $messages = array_merge($salesking_messages, $b2bking_messages);
            
            // check how many are unread
            $unread_msg = 0;
            foreach ($messages as $message){
                // Check if this is a SalesKing or B2BKing message
                $post_type = get_post_type($message);
                
                if ($post_type === 'salesking_message') {
                    // SalesKing message logic
                    $nr_messages = get_post_meta ($message, 'salesking_message_messages_number', true);
                    $last_message_author = get_post_meta ($message, 'salesking_message_message_'.$nr_messages.'_author', true);
                    if ($last_message_author !== $currentuserlogin){
                        // chek if last read time is lower than last msg time
                        $last_read_time = get_user_meta($user_id,'salesking_message_last_read_'.$message, true);
                        if (!empty($last_read_time)){
                            $last_message_time = get_post_meta ($message, 'salesking_message_message_'.$nr_messages.'_time', true);
                            if (floatval($last_read_time) < floatval($last_message_time)){
                                $unread_msg++;
                            }
                        } else {
                            $unread_msg++;
                        }
                    }
                } elseif ($post_type === 'b2bking_conversation') {
                    // B2BKing message logic
                    $nr_messages = get_post_meta ($message, 'b2bking_conversation_messages_number', true);
                    $last_message_author = get_post_meta ($message, 'b2bking_conversation_message_'.$nr_messages.'_author', true);
                    if ($last_message_author !== $currentuserlogin){
                        // check if last read time is lower than last msg time
                        $last_read_time = get_user_meta($user_id,'b2bking_conversation_last_read_'.$message, true);
                        if (!empty($last_read_time)){
                            $last_message_time = get_post_meta ($message, 'b2bking_conversation_message_'.$nr_messages.'_time', true);
                            if (floatval($last_read_time) < floatval($last_message_time)){
                                $unread_msg++;
                            }
                        } else {
                            $unread_msg++;
                        }
                    }
                }
            }

            // display an Agent ID. If none exists, generate it now and set it as user meta.
            $agent_id = get_user_meta($user_id, 'salesking_agentid', true);
            if (empty($agent_id)){
                $characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                $agent_id = '';
                for ($i = 0; $i < 10; $i++)
                $agent_id .= $characters[mt_rand(0, 35)];
                $agent_id = strtoupper($agent_id);
                update_user_meta($user_id,'salesking_agentid', $agent_id);
            }



            ?>
            <?php include(apply_filters('salesking_dashboard_template','templates/sidebar.php')); ?>

            <div class="nk-wrap ">
                <?php

                include(apply_filters('salesking_dashboard_template','templates/header-bar.php'));

                // get page
                $page = get_query_var('dashpage');

                
                if (empty($page)){
                    // Agent dashboard here
                    include(apply_filters('salesking_dashboard_template','dashboard-content.php'));
                }
                
                if ($page === 'announcements'){
                    include(apply_filters('salesking_dashboard_template','announcements.php'));
                } else if ($page === 'announcement'){
                    include(apply_filters('salesking_dashboard_template','announcement.php'));
                } else if ($page === 'messages'){
                    include(apply_filters('salesking_dashboard_template','messages.php'));
                } else if ($page === 'customers'){
                    include(apply_filters('salesking_dashboard_template','customers.php'));
                } else if ($page === 'profile'){
                    include(apply_filters('salesking_dashboard_template','profile.php'));
                } else if ($page === 'profile-settings'){
                    include(apply_filters('salesking_dashboard_template','profile-settings.php'));
                } else if ($page === 'orders'){
                    include(apply_filters('salesking_dashboard_template','orders.php'));
                } else if ($page === 'offers-b2b'){
                    include(apply_filters('salesking_dashboard_template','offers.php'));
                } else if ($page === 'earnings'){
                    include(apply_filters('salesking_dashboard_template','earnings.php'));
                } else if ($page === 'payouts'){
                    include(apply_filters('salesking_dashboard_template','payouts.php'));
                } else if ($page === 'team'){
                    include(apply_filters('salesking_dashboard_template','teams.php'));
                } else if ($page === 'affiliate-links'){
                    include(apply_filters('salesking_dashboard_template','affiliate-links.php'));
                } else if ($page === 'cart-sharing'){
                    include(apply_filters('salesking_dashboard_template','cart-sharing.php'));
                } else if ($page === 'coupons'){
                    include(apply_filters('salesking_dashboard_template','coupons.php'));
                }

                do_action('salesking_extend_page', $page);

                ?>
                <div id="salesking_footer_hidden">
                    <?php
                    if (apply_filters('salesking_display_footer_scripts', false)){
                        wp_footer();
                    }
                    ?>
                </div>

            </div>
        </div>
        <!-- main @e -->
    </div>
    <!-- app-root @e -->
</body>
