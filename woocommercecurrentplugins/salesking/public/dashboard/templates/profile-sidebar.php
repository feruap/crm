<div class="card-aside card-aside-left user-aside toggle-slide toggle-slide-left toggle-break-lg" data-content="userAside" data-toggle-screen="lg" data-toggle-overlay="true">
    <div class="card-inner-group" data-simplebar>
        <div class="card-inner">
            <div class="user-card">
                <div class="user-avatar bg-primary">
                    <span><?php echo esc_html(mb_strtoupper(mb_substr($currentuser->user_login, 0, 2)))    ;?></span>
                </div>
                <div class="user-info">
                    <span class="lead-text"><?php echo apply_filters('salesking_profile_display_name',esc_html($currentuser->first_name.' '.$currentuser->last_name), $currentuser); ?></span>
                    <span class="sub-text"><?php esc_html_e('Agent ID:','salesking'); echo ' '.esc_html($agent_id); ?></span>
                </div>
                
            </div><!-- .user-card -->
        </div><!-- .card-inner -->
        <?php
            if (apply_filters('salesking_show_account_balance', true)){
                ?>
                <div class="card-inner">
                    <div class="user-account-info py-0">
                        <h6 class="overline-title-alt"><?php esc_html_e('Account Balance','salesking');?></h6>
                        <div class="user-balance"><?php 

                        $outstanding_balance = get_user_meta($user_id,'salesking_outstanding_earnings', true);
                        if (empty($outstanding_balance)){
                            $outstanding_balance = 0;
                        }
                        echo wc_price($outstanding_balance);

                        ?></div>
                    </div>
                </div><!-- .card-inner -->
                <?php
            }
        ?>
        <div class="card-inner p-0">
            <ul class="link-list-menu">
                <li><a class="<?php if ($page ==='profile'){echo 'active';}?>" href="<?php echo esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true)))).'profile';?>"><em class="icon ni ni-user-fill-c"></em><span><?php esc_html_e('Personal Infomation','salesking');?></span></a></li>
                <?php
                 if (intval(get_option( 'salesking_enable_announcements_setting', 1 )) === 1 or intval(get_option( 'salesking_enable_messages_setting', 1 )) === 1){
                    ?>
                    <li><a class="<?php if ($page ==='profile-settings'){echo 'active';}?>" href="<?php echo esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true)))).'profile-settings';?>"><em class="icon ni ni-opt-alt-fill"></em><span><?php esc_html_e('Settings','salesking');?></span></a></li>
                    <?php
                }
                ?>
            </ul>
        </div><!-- .card-inner -->
    </div><!-- .card-inner-group -->
</div><!-- card-aside -->