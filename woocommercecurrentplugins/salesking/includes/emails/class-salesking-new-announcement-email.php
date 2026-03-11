<?php

if ( ! defined( 'ABSPATH' ) ) exit; // Exit if accessed directly

if (!class_exists('Salesking_New_Announcement_Email')) {
    class Salesking_New_Announcement_Email extends WC_Email {

        public $announcement;
        public $userid;
        public $announcementid;

        public function __construct() {

            $this->announcement = '';
            $this->userid = '';
            $this->announcementid = '';

            // set ID, this simply needs to be a unique name
            $this->id = 'salesking_new_announcement_email';

            // this is the title in WooCommerce Email settings
            $this->title = esc_html__('New announcement', 'salesking');

            // this is the description in WooCommerce email settings
            $this->description = esc_html__('This email is sent when a new announcement is released', 'salesking');

            // these are the default heading and subject lines that can be overridden using the settings
            $this->heading = esc_html__('New announcement', 'salesking');
            $this->subject = esc_html__('New announcement', 'salesking');

            $this->template_base  = SALESKING_DIR . 'includes/emails/templates/';
            $this->template_html  = 'new-announcement-email-template.php';
            $this->template_plain =  'plain-new-announcement-email-template.php';
            
            // Call parent constructor to load any other defaults not explicity defined here
            parent::__construct();

            add_action( 'salesking_new_announcement_notification', array( $this, 'trigger'), 10, 4 );

        }

        public function trigger($email_address, $announcement, $userid, $announcementid) {

            $this->recipient = $email_address;
            $this->announcement = $announcement;
            $this->userid = $userid;
            $this->announcementid = $announcementid;

            if ( ! $this->is_enabled() || ! $this->get_recipient() ){
               return;
            }
            
            do_action('wpml_switch_language_for_email', $email_address);
            $this->heading = esc_html__('New announcement', 'salesking');
            $this->subject = esc_html__('New announcement', 'salesking');

            // check if the user has new announcement emails enabled.
            $user = get_user_by('email', $email_address);
            $permission = get_user_meta($user->ID, 'salesking_receive_new_announcements_emails', true);
            if (empty($permission) || $permission === 'yes'){
                $this->send( $this->get_recipient(), $this->get_subject(), $this->get_content(), $this->get_headers(), $this->get_attachments() );
            }
            do_action('wpml_restore_language_from_email');
         
        }

        public function get_content_html() {
            ob_start();
            if (method_exists($this, 'get_additional_content')){
                $additional_content_checked = $this->get_additional_content();
            } else {
                $additional_content_checked = false;
            }
            wc_get_template( $this->template_html, array(
                'email_heading'      => $this->get_heading(),
                'additional_content' => $additional_content_checked,
                'announcement'       => $this->announcement,
                'userid'             => $this->userid,
                'announcementid'     => $this->announcementid,
                'email'              => $this,
            ), $this->template_base, $this->template_base  );
            return ob_get_clean();
        }


        public function get_content_plain() {
            ob_start();
            if (method_exists($this, 'get_additional_content')){
                $additional_content_checked = $this->get_additional_content();
            } else {
                $additional_content_checked = false;
            }
            wc_get_template( $this->template_plain, array(
                'email_heading'      => $this->get_heading(),
    			'additional_content' => $additional_content_checked,
                'announcement'       => $this->announcement,
                'userid'             => $this->userid,
                'announcementid'     => $this->announcementid,
    			'email'              => $this,
            ), $this->template_base, $this->template_base );
            return ob_get_clean();
        }

        public function init_form_fields() {

            $this->form_fields = array(
                'enabled'    => array(
                    'title'   => esc_html__( 'Enable/Disable', 'salesking' ),
                    'type'    => 'checkbox',
                    'label'   => esc_html__( 'Enable this email notification', 'salesking' ),
                    'default' => 'yes',
                ),
                'subject'    => array(
                    'title'       => 'Subject',
                    'type'        => 'text',
                    'description' => esc_html__('This controls the email subject line. Leave blank to use the default subject: ','salesking').sprintf( '<code>%s</code>.', $this->subject ),
                    'placeholder' => '',
                    'default'     => ''
                ),
                'heading'    => array(
                    'title'       => esc_html__('Email Heading','salesking'),
                    'type'        => 'text',
                    'description' => esc_html__('This controls the main heading contained within the email notification. Leave blank to use the default heading: ','salesking').sprintf( '<code>%s</code>.', $this->heading ),
                    'placeholder' => '',
                    'default'     => ''
                ),
                'email_type' => array(
                    'title'       => esc_html__('Email type','salesking'),
                    'type'        => 'select',
                    'description' => esc_html__('Choose which format of email to send.','salesking'),
                    'default'     => 'html',
                    'class'       => 'email_type',
                    'options'     => array(
                        'plain'     => 'Plain text',
                        'html'      => 'HTML', 'woocommerce',
                        'multipart' => 'Multipart', 'woocommerce',
                    )
                )
            );
        }

    }
}
return new Salesking_New_Announcement_Email();