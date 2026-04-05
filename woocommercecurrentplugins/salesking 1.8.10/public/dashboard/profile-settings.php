<div class="nk-content salesking_profile_settings_page">
    <div class="container-fluid">
        <div class="nk-content-inner">
            <div class="nk-content-body">
                <div class="nk-block">
                    <div class="card">
                        <div class="card-aside-wrap">
                            <div class="card-inner card-inner-lg">
                                <div class="nk-block-head nk-block-head-lg">
                                    <div class="nk-block-between">
                                        <div class="nk-block-head-content">
                                            <h4 class="nk-block-title"><?php esc_html_e('Profile Settings','salesking');?></h4>

                                        </div>
                                        <div class="nk-block-head-content align-self-start d-lg-none">
                                            <a href="#" class="toggle btn btn-icon btn-trigger mt-n1" data-target="userAside"><em class="icon ni ni-menu-alt-r"></em></a>
                                        </div>
                                    </div>
                                </div><!-- .nk-block-head -->
                                <div class="nk-block-head nk-block-head-sm">
                                    <div class="nk-block-head-content">
                                        <h6><?php esc_html_e('Email Settings','salesking');?></h6>
                                        <p><?php esc_html_e('Choose which email notifications you would like to receive.','salesking');?></p>
                                    </div>
                                </div><!-- .nk-block-head -->
                                <?php
                                $new_announcements_email = get_user_meta($user_id,'salesking_receive_new_announcements_emails', true);
                                if (empty($new_announcements_email)){
                                    $new_announcements_email = 'yes';
                                }

                                $new_messages_email = get_user_meta($user_id,'salesking_receive_new_messages_emails', true);
                                if (empty($new_messages_email)){
                                    $new_messages_email = 'yes';
                                }

                                ?>
                                <div class="nk-block-content">
                                    <div class="gy-3">
                                        <?php
                                            if (intval(get_option( 'salesking_enable_announcements_setting', 1 )) === 1){
                                            ?>
                                            <div class="g-item">
                                                <div class="custom-control custom-switch">
                                                    <input type="checkbox" class="custom-control-input" <?php checked('yes',$new_announcements_email, true); ?> id="new-announcements">
                                                    <label class="custom-control-label" for="new-announcements"><?php esc_html_e('Email me when new announcements are published.','salesking');?></label>
                                                </div>
                                            </div>
                                            <?php
                                        }
                                        ?>
                                        <?php
                                        if (intval(get_option( 'salesking_enable_messages_setting', 1 )) === 1){
                                            ?>
                                            <div class="g-item">
                                                <div class="custom-control custom-switch">
                                                    <input type="checkbox" class="custom-control-input" <?php checked('yes',$new_messages_email, true); ?> id="new-messages">
                                                    <label class="custom-control-label" for="new-messages"><?php esc_html_e('Email me when I receive a new message.','salesking');?></label>
                                                </div>
                                            </div>
                                            <?php
                                        }
                                        ?>
                                    </div>
                                    <br><br>
                                    <button class="btn btn-primary" type="submit" id="salesking_save_settings" value="<?php echo esc_attr($user_id);?>"><?php esc_html_e('Save Settings','salesking');?></button>
                                </div><!-- .nk-block-content -->
                            </div>
                            <?php include('templates/profile-sidebar.php'); ?>
                        </div><!-- .card-inner -->
                    </div><!-- .card-aside-wrap -->
                </div><!-- .nk-block -->
            </div>
        </div>
    </div>
</div>