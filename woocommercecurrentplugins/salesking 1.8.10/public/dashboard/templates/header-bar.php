<!-- main header @s -->
<div class="nk-header nk-header-fixed is-light">
    <div class="container-fluid">
        <div class="nk-header-wrap">
            <div class="nk-menu-trigger d-xl-none ml-n1">
                <a href="#" class="nk-nav-toggle nk-quick-nav-icon" data-target="sidebarMenu"><em class="icon ni ni-menu"></em></a>
            </div>
            <?php
            do_action('salesking_dashboard_header_bar');
            ?>
            <div class="nk-header-brand d-xl-none">
                <a href="<?php echo esc_attr(get_home_url());?>" class="logo-link">
                    <img class="logo-dark logo-img" src="<?php echo esc_url($logo_src); ?>" alt="logo-dark">
                </a>
            </div><!-- .nk-header-brand -->
            <div class="nk-header-tools">
                <ul class="nk-quick-nav">
                    <?php
                    if (intval(get_option( 'salesking_enable_messages_setting', 1 )) === 1){
                        ?>
                        <li class="dropdown chats-dropdown hide-mb-xs">
                            <a href="#" class="dropdown-toggle nk-quick-nav-icon" data-toggle="dropdown">
                                <div class="icon-status icon-status-na"><em class="icon ni ni-comments"></em></div>
                            </a>
                            <div class="dropdown-menu dropdown-menu-xl dropdown-menu-right">
                                <div class="dropdown-head">
                                    <span class="sub-title nk-dropdown-title"><?php esc_html_e('Recent Messages','salesking'); ?></span>
                                </div>
                                <div class="dropdown-body">
                                    <ul class="chat-list">
                                        <?php
                                        // remove closed messages
                                        $closedmsg = array();
                                        foreach ($messages as $message){
                                            $post_type = get_post_type($message);
                                            
                                            if ($post_type === 'salesking_message') {
                                                $nr_messages = get_post_meta ($message, 'salesking_message_messages_number', true);
                                                $last_closed_time = get_user_meta($user_id,'salesking_message_last_closed_'.$message, true);
                                                if (!empty($last_closed_time)){
                                                    $last_message_time = get_post_meta ($message, 'salesking_message_message_'.$nr_messages.'_time', true);
                                                    if (floatval($last_closed_time) > floatval($last_message_time)){
                                                        array_push($closedmsg, $message);
                                                    }
                                                }
                                            } elseif ($post_type === 'b2bking_conversation') {
                                                $nr_messages = get_post_meta ($message, 'b2bking_conversation_messages_number', true);
                                                $last_closed_time = get_user_meta($user_id,'b2bking_conversation_last_closed_'.$message, true);
                                                if (!empty($last_closed_time)){
                                                    $last_message_time = get_post_meta ($message, 'b2bking_conversation_message_'.$nr_messages.'_time', true);
                                                    if (floatval($last_closed_time) > floatval($last_message_time)){
                                                        array_push($closedmsg, $message);
                                                    }
                                                }
                                            }
                                        }

                                        $messagesarr = array_diff($messages,$closedmsg);
                                        // show last 6 messages that are active (not closed)
                                        $messagesarr = array_slice($messagesarr, 0, 6);
                                        foreach ($messagesarr as $message){ // message is a message thread e.g. conversation

                                            $post_type = get_post_type($message);
                                            $title = substr(get_the_title($message), 0, 65);
                                            if (strlen($title) === 65){
                                                $title .= '...';
                                            }
                                            
                                            if ($post_type === 'salesking_message') {
                                                $nr_messages = get_post_meta ($message, 'salesking_message_messages_number', true);
                                                $last_message_time = get_post_meta ($message, 'salesking_message_message_'.$nr_messages.'_time', true);
                                                $last_message = get_post_meta ($message, 'salesking_message_message_'.$nr_messages, true);
                                                $last_message_author = get_post_meta ($message, 'salesking_message_message_'.$nr_messages.'_author', true);
                                                
                                                // get the other party in the chat
                                                $author = get_post_meta ($message, 'salesking_message_message_1_author', true);
                                                $convuser = get_post_meta ($message, 'salesking_message_user', true);
                                                if ($convuser === 'shop'){
                                                    $convuser = esc_html__('Shop','salesking'); 
                                                    if (get_post_meta ($message, 'salesking_message_message_2_author', true) !== $author && !empty(get_post_meta ($message, 'salesking_message_message_2_author', true))){
                                                        $convuser = get_post_meta ($message, 'salesking_message_message_2_author', true);
                                                    }
                                                }
                                                if ($author === $currentuserlogin){
                                                    $author = $convuser;
                                                }
                                            } elseif ($post_type === 'b2bking_conversation') {
                                                $nr_messages = get_post_meta ($message, 'b2bking_conversation_messages_number', true);
                                                $last_message_time = get_post_meta ($message, 'b2bking_conversation_message_'.$nr_messages.'_time', true);
                                                $last_message = get_post_meta ($message, 'b2bking_conversation_message_'.$nr_messages, true);
                                                $last_message_author = get_post_meta ($message, 'b2bking_conversation_message_'.$nr_messages.'_author', true);
                                                
                                                // get the other party in the chat
                                                $author = get_post_meta ($message, 'b2bking_conversation_message_1_author', true);
                                                $convuser = get_post_meta ($message, 'b2bking_conversation_user', true);
                                                if ($author === $currentuserlogin){
                                                    $author = $convuser;
                                                }
                                            } else {
                                                continue;
                                            }

                                            // build time string
                                            // if today
                                            if((time()-$last_message_time) < 86400){
                                                // show time
                                                $timestring = date_i18n( 'h:i A', $last_message_time+(get_option('gmt_offset')*3600) );
                                            } else if ((time()-$last_message_time) < 172800){
                                            // if yesterday
                                                $timestring = esc_html__('Yesterday at ','salesking').date_i18n( 'h:i A', $last_message_time+(get_option('gmt_offset')*3600) );
                                            } else {
                                            // date
                                                $timestring = date_i18n( get_option('date_format'), $last_message_time+(get_option('gmt_offset')*3600) ); 
                                            }

                                            // first 100 chars
                                            $last_message = substr($last_message, 0, 100);

                                            // check if message is unread
                                            $is_unread = '';
                                            if ($last_message_author !== $currentuserlogin){
                                                if ($post_type === 'salesking_message') {
                                                    $last_read_time = get_user_meta($user_id,'salesking_message_last_read_'.$message, true);
                                                } else {
                                                    $last_read_time = get_user_meta($user_id,'b2bking_conversation_last_read_'.$message, true);
                                                }
                                                
                                                if (!empty($last_read_time)){
                                                    if (floatval($last_read_time) < floatval($last_message_time)){
                                                        $is_unread = 'is-unread';
                                                    }
                                                } else {
                                                    $is_unread = 'is-unread';
                                                }
                                            } 

                                            ?>
                                            <li class="chat-item <?php echo esc_attr($is_unread);?>">
                                                <a class="chat-link" href="<?php echo trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true))).'messages?id='.esc_attr($message).'&type='.esc_attr($post_type);?>">
                                                    <div class="chat-media user-avatar">
                                                        <span><?php echo esc_html(mb_strtoupper(mb_substr($author, 0, 2)))    ;?></span>
                                                    </div>
                                                    <div class="chat-info">
                                                        <div class="chat-from">
                                                            <div class="name"><?php echo esc_html($title);?></div>
                                                            <span class="time"><?php echo esc_html($timestring);?></span>
                                                        </div>
                                                        <div class="chat-context">
                                                            <div class="text"><?php echo esc_html($last_message);?></div>
                                                            <?php if ($post_type === 'b2bking_conversation') { 
                                                                if (apply_filters('salesking_show_b2b_badge', false)){
                                                                    ?>
                                                                    <div class="badge badge-sm badge-info">B2B</div>
                                                                    <?php 
                                                                }

                                                            } ?>
                                                        </div>
                                                    </div>
                                                </a>
                                            </li><!-- .chat-item -->
                                            <?php

                                        }
                                        ?>
                                    </ul><!-- .chat-list -->
                                </div><!-- .nk-dropdown-body -->
                                <div class="dropdown-foot center">
                                    <a href="<?php echo esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true))).'messages'); ?>"><?php esc_html_e('View All', 'salesking'); ?></a>
                                </div>
                            </div>
                        </li>
                        <?php
                    }
                    ?>
                    <?php
                    if (intval(get_option( 'salesking_enable_announcements_setting', 1 )) === 1){
                        ?>
                        <li class="dropdown notification-dropdown">
                            <a href="#" class="dropdown-toggle nk-quick-nav-icon" data-toggle="dropdown">
                                <div class="icon-status <?php if ($unread_ann !== 0) {echo 'icon-status-info';}?>"><em class="icon ni ni-bell"></em></div>
                            </a>
                            <div class="dropdown-menu dropdown-menu-xl dropdown-menu-right">
                                <div class="dropdown-head">
                                    <span class="sub-title nk-dropdown-title"><?php esc_html_e('Unread Announcements', 'salesking'); ?></span>
                                </div>
                                <div class="dropdown-body">
                                    <?php
                                    // show all announcements
                                    $i=1;
                                    foreach ($announcements as $announcement){
                                        $read_status = get_user_meta($user_id,'salesking_announce_read_'.$announcement->ID, true);
                                        if (!$read_status || empty($read_status)){
                                            // is unread, so let's display it
                                            $i++;
                                        } else {
                                            continue;
                                        }

                                        if ($i>6){
                                            continue;
                                        }

                                        ?>
                                        <div class="nk-notification">
                                            <div class="nk-notification-item dropdown-inner">
                                                <div class="nk-notification-icon">
                                                    <em class="icon icon-circle bg-warning-dim ni ni-curve-down-right"></em>
                                                </div>
                                                <div class="nk-notification-content">
                                                    <a href="<?php echo esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true))).'announcement/?id='.esc_attr($announcement->ID)); ?>"><div class="nk-notification-text"><?php echo esc_html($announcement->post_title);?></div></a>
                                                    <div class="nk-notification-time"><?php echo esc_html(get_the_date(get_option( 'date_format' ), $announcement));?></div>
                                                </div>
                                            </div>
                                        </div><!-- .nk-notification -->
                                        <?php
                                    }
                                    ?>
                                </div><!-- .nk-dropdown-body -->
                                <div class="dropdown-foot center">
                                    <a href="<?php echo esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true))).'announcements'); ?>"><?php esc_html_e('View All', 'salesking'); ?></a>
                                </div>
                            </div>
                        </li>
                        <?php
                    }
                    ?>
                    <li class="dropdown user-dropdown">
                        <a href="#" class="dropdown-toggle mr-n1" data-toggle="dropdown">
                            <div class="user-toggle">
                                <div class="user-avatar sm">
                                    <em class="icon ni ni-user-alt"></em>
                                </div>
                                <div class="user-info d-none d-xl-block">
                                    <div class="user-status user-status-active"><?php esc_html_e('Sales Agent','salesking');?></div>
                                    <div class="user-name dropdown-indicator"><?php echo apply_filters('salesking_top_right_display_name',esc_html($currentuser->first_name.' '.$currentuser->last_name), $currentuser); ?></div>
                                </div>
                            </div>
                        </a>
                        <div class="dropdown-menu dropdown-menu-md dropdown-menu-right">
                            <div class="dropdown-inner user-card-wrap bg-lighter d-none d-md-block">
                                <div class="user-card">
                                    <div class="user-avatar">
                                        <span><?php echo esc_html(mb_strtoupper(mb_substr($currentuser->user_login, 0, 2)))    ;?></span>
                                    </div>
                                    <div class="user-info">
                                        <span class="lead-text"><?php echo apply_filters('salesking_top_right_display_name',esc_html($currentuser->first_name.' '.$currentuser->last_name), $currentuser); ?></span>
                                        <span class="sub-text"><?php esc_html_e('Agent ID:','salesking'); echo ' '.esc_html($agent_id); ?></span>
                                    </div>
                                </div>
                            </div>
                            <div class="dropdown-inner">
                                <ul class="link-list">
                                    <li><a href="<?php echo esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true)))).'profile';?>"><em class="icon ni ni-account-setting-fill"></em><span><?php esc_html_e('Manage Profile','salesking');?></span></a></li>
                                </ul>

                            </div>
                            <div class="dropdown-inner">
                                <ul class="link-list">
                                    <li><a href="<?php echo esc_url(wc_logout_url()); ?>"><em class="icon ni ni-signout"></em><span><?php esc_html_e('Sign out','salesking');?></span></a></li>
                                </ul>
                            </div>
                        </div>
                    </li>
                </ul>
            </div>
        </div><!-- .nk-header-wrap -->
    </div><!-- .container-fliud -->
</div>
<!-- main header @e -->
<!-- content @s -->