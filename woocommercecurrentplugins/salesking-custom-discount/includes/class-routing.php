<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class SK_CD_Routing {

    public static function get_approver_for_discount( $agent_id, $requested_discount ) {
        $requested_discount = floatval( $requested_discount );
        $current = intval( $agent_id );
        $visited = array();
        for ( $i = 0; $i < 20; $i++ ) {
            $parent_id = get_user_meta( $current, 'salesking_parent_agent', true );
            if ( empty( $parent_id ) || intval( $parent_id ) <= 0 || ! get_userdata( intval( $parent_id ) ) ) { return 'admin'; }
            $parent_id = intval( $parent_id );
            if ( in_array( $parent_id, $visited, true ) ) { return 'admin'; }
            $visited[] = $parent_id;
            $max = self::get_agent_max_discount( $parent_id );
            if ( $max >= $requested_discount ) { return $parent_id; }
            $current = $parent_id;
        }
        return 'admin';
    }

    public static function get_agent_max_discount( $agent_id ) {
        $val = get_user_meta( $agent_id, 'salesking_group_max_discount', true );
        if ( ! empty( $val ) && floatval( $val ) > 0 ) { return floatval( $val ); }
        $group_id = get_user_meta( $agent_id, 'salesking_group', true );
        if ( ! empty( $group_id ) && $group_id !== 'none' ) {
            $gval = get_post_meta( $group_id, 'salesking_group_max_discount', true );
            if ( ! empty( $gval ) && floatval( $gval ) > 0 ) { return floatval( $gval ); }
        }
        return 0;
    }

    public static function get_all_children( $agent_id ) {
        $children = array();
        $users = get_users( array( 'meta_key' => 'salesking_parent_agent', 'meta_value' => $agent_id ) );
        foreach ( $users as $u ) {
            $children[] = $u->ID;
            $sub = self::get_all_children( $u->ID );
            $children = array_merge( $children, $sub );
        }
        return $children;
    }

    public static function is_ancestor_of( $potential_ancestor, $agent_id ) {
        $current = intval( $agent_id );
        for ( $i = 0; $i < 20; $i++ ) {
            $parent = get_user_meta( $current, 'salesking_parent_agent', true );
            if ( empty( $parent ) || intval( $parent ) <= 0 ) { return false; }
            if ( intval( $parent ) === intval( $potential_ancestor ) ) { return true; }
            $current = intval( $parent );
        }
        return false;
    }
}
