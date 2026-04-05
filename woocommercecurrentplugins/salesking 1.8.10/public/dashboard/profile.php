<div class="nk-content salesking_profile_page">
    <?php
    $userdata = get_userdata($user_id);
    ?>
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
                                            <h4 class="nk-block-title"><?php esc_html_e('Personal Information','salesking');?></h4>
                                            <div class="nk-block-des">
                                                <p><?php esc_html_e('Your basic profile information.','salesking');?></p>
                                            </div>
                                        </div>
                                        <div class="nk-block-head-content align-self-start d-lg-none">
                                            <a href="#" class="toggle btn btn-icon btn-trigger mt-n1" data-target="userAside"><em class="icon ni ni-menu-alt-r"></em></a>
                                        </div>
                                    </div>
                                </div><!-- .nk-block-head -->
                                <div class="nk-block">
                                    <div class="nk-data data-list">
                                        <div class="data-head">
                                            <h6 class="overline-title"><?php esc_html_e('User Info','salesking');?></h6>
                                        </div>
                                        <div class="data-item" data-toggle="modal" data-target="#profile-edit">
                                            <div class="data-col">
                                                <span class="data-label"><?php esc_html_e('First Name','salesking');?></span>
                                                <span class="data-value"><?php echo esc_html($userdata->first_name);?></span>
                                            </div>
                                            <div class="data-col data-col-end"><span class="data-more"><em class="icon ni ni-forward-ios"></em></span></div>
                                        </div><!-- data-item -->
                                        <div class="data-item" data-toggle="modal" data-target="#profile-edit">
                                            <div class="data-col">
                                                <span class="data-label"><?php esc_html_e('Last Name','salesking');?></span>
                                                <span class="data-value"><?php echo esc_html($userdata->last_name);?></span>
                                            </div>
                                            <div class="data-col data-col-end"><span class="data-more"><em class="icon ni ni-forward-ios"></em></span></div>
                                        </div><!-- data-item -->
                                        <div class="data-item" data-toggle="modal" data-target="#profile-edit">
                                            <div class="data-col">
                                                <span class="data-label"><?php esc_html_e('Display Name','salesking');?></span>
                                                <span class="data-value"><?php echo esc_html($userdata->display_name);?></span>
                                            </div>
                                            <div class="data-col data-col-end"><span class="data-more"><em class="icon ni ni-forward-ios"></em></span></div>
                                        </div><!-- data-item -->
                                        <div class="data-item"  data-toggle="modal" data-target="#profile-edit">
                                            <div class="data-col" >
                                                <span class="data-label"><?php esc_html_e('Email','salesking');?></span>
                                                <span class="data-value"><?php echo esc_html($userdata->user_email);?></span>
                                            </div>
                                            <div class="data-col data-col-end"><span class="data-more"><em class="icon ni ni-forward-ios"></em></span></div>
                                        </div><!-- data-item -->

                                    </div><!-- data-list -->
                                </div><!-- .nk-block -->
                            </div>
                            <?php include('templates/profile-sidebar.php'); ?>
                            <div class="modal fade" tabindex="-1" role="dialog" id="profile-edit">
                                <div class="modal-dialog modal-dialog-centered modal-lg" role="document">
                                    <div class="modal-content">
                                        <a href="#" class="close" data-dismiss="modal"><em class="icon ni ni-cross-sm"></em></a>
                                        <div class="modal-body modal-body-lg">
                                            <h5 class="title"><?php esc_html_e('Update Profile','salesking');?></h5>
                                            <ul class="nk-nav nav nav-tabs">
                                                <li class="nav-item">
                                                    <a class="nav-link active" data-toggle="tab" href="#personal"><?php esc_html_e('Personal','salesking');?></a>
                                                </li>
                                            </ul><!-- .nav-tabs -->
                                            <div class="tab-content">
                                                <div class="tab-pane active" id="personal">
                                                    <div class="row gy-4">
                                                        <div class="col-md-6">
                                                            <div class="form-group">
                                                                <label class="form-label" for="first-name"><?php esc_html_e('First Name','salesking');?></label>
                                                                <input type="text" class="form-control form-control-lg" id="first-name" value="<?php echo esc_attr($userdata->first_name);?>" placeholder="<?php esc_html_e('Enter your first name...','salesking');?>">
                                                            </div>
                                                        </div>
                                                        <div class="col-md-6">
                                                            <div class="form-group">
                                                                <label class="form-label" for="last-name"><?php esc_html_e('Last Name','salesking');?></label>
                                                                <input type="text" class="form-control form-control-lg" id="last-name" value="<?php echo esc_attr($userdata->last_name);?>" placeholder="<?php esc_html_e('Enter your last name...','salesking');?>">
                                                            </div>
                                                        </div>
                                                        <div class="col-md-6">
                                                            <div class="form-group">
                                                                <label class="form-label" for="display-name"><?php esc_html_e('Display Name','salesking');?></label>
                                                                <input type="text" class="form-control form-control-lg" id="display-name"  value="<?php echo esc_attr($userdata->display_name);?>" placeholder="<?php esc_html_e('Enter your display name...','salesking');?>">
                                                            </div>
                                                        </div>
                                                        <?php
                                                        if (apply_filters('salesking_allow_email_update', true)){
                                                            ?>
                                                            <div class="col-md-6">
                                                                <div class="form-group">
                                                                    <label class="form-label" for="email"><?php esc_html_e('Email','salesking');?></label>
                                                                    <input type="email" class="form-control form-control-lg" value="<?php echo esc_attr($userdata->user_email);?>" id="email" placeholder="<?php esc_html_e('Enter your email...','salesking');?>">
                                                                </div>
                                                            </div>
                                                            <?php
                                                        }
                                                        ?>
                                                        <div class="col-12">
                                                            <ul class="align-center flex-wrap flex-sm-nowrap gx-4 gy-2">
                                                                <li>
                                                                    <button id="salesking_update_profile" class="btn btn-lg btn-primary"><?php esc_html_e('Update Profile','salesking');?></button>
                                                                </li>
                                                                <li>
                                                                    <a href="#" data-dismiss="modal" class="link link-light"><?php esc_html_e('Cancel','salesking');?></a>
                                                                </li>
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </div><!-- .tab-pane -->

                                            </div><!-- .tab-content -->
                                        </div><!-- .modal-body -->
                                    </div><!-- .modal-content -->
                                </div><!-- .modal-dialog -->
                            </div><!-- .modal -->
                        </div><!-- .card-aside-wrap -->
                    </div><!-- .card -->
                </div><!-- .nk-block -->
            </div>
        </div>
    </div>
</div>