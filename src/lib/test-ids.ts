/**
 * Test IDs for E2E testing
 *
 * Organized by feature/page for easy navigation.
 * Use these enums in both components (data-testid) and tests (getByTestId).
 *
 * Naming convention: {domain}-{component}-{element}-{type}
 * - Enum keys: SCREAMING_SNAKE_CASE
 * - Enum values: kebab-case
 */

/**
 * Auth page test IDs
 * Used in: src/pages/Auth.tsx
 */
export enum AuthTestIds {
  // Sign-in form
  SIGNIN_EMAIL_INPUT = 'auth-signin-email-input',
  SIGNIN_PASSWORD_INPUT = 'auth-signin-password-input',
  SIGNIN_SUBMIT_BUTTON = 'auth-signin-submit-button',
  SIGNIN_ERROR_EMAIL = 'auth-signin-error-email',
  SIGNIN_ERROR_PASSWORD = 'auth-signin-error-password',

  // Sign-up form
  SIGNUP_NAME_INPUT = 'auth-signup-name-input',
  SIGNUP_EMAIL_INPUT = 'auth-signup-email-input',
  SIGNUP_PASSWORD_INPUT = 'auth-signup-password-input',
  SIGNUP_COUNTRY_SELECT = 'auth-signup-country-select',
  SIGNUP_FIELD_SELECT = 'auth-signup-field-select',
  SIGNUP_SUBMIT_BUTTON = 'auth-signup-submit-button',
  SIGNUP_ERROR_NAME = 'auth-signup-error-name',
  SIGNUP_ERROR_EMAIL = 'auth-signup-error-email',
  SIGNUP_ERROR_PASSWORD = 'auth-signup-error-password',
  SIGNUP_ERROR_COUNTRY = 'auth-signup-error-country',
  SIGNUP_ERROR_FIELD = 'auth-signup-error-field',

  // Password reset flow
  RESET_EMAIL_INPUT = 'auth-reset-email-input',
  RESET_SEND_BUTTON = 'auth-reset-send-button',
  RESET_BACK_BUTTON = 'auth-reset-back-button',
  RESET_ERROR_EMAIL = 'auth-reset-error-email',

  // Password update flow
  UPDATE_PASSWORD_INPUT = 'auth-update-password-input',
  UPDATE_CONFIRM_INPUT = 'auth-update-confirm-input',
  UPDATE_SUBMIT_BUTTON = 'auth-update-submit-button',
  UPDATE_ERROR_PASSWORD = 'auth-update-error-password',
  UPDATE_ERROR_CONFIRM = 'auth-update-error-confirm',

  // Tab navigation
  TAB_SIGNIN = 'auth-tab-signin',
  TAB_SIGNUP = 'auth-tab-signup',

  // Links
  FORGOT_PASSWORD_LINK = 'auth-forgot-password-link',

  // General errors
  ERROR_MESSAGE = 'auth-error-message',
}

/**
 * Verify Email page test IDs
 * Used in: src/pages/VerifyEmail.tsx
 */
export enum VerifyEmailTestIds {
  HEADING = 'verify-email-heading',
  EMAIL_DISPLAY = 'verify-email-email-display',
  VERIFICATION_MESSAGE = 'verify-email-verification-message',
  RESEND_BUTTON = 'verify-email-resend-button',
  BACK_TO_SIGNIN_BUTTON = 'verify-email-back-to-signin-button',
}

/**
 * Navigation test IDs
 * Used in: src/components/auth/UserMenu.tsx
 */
export enum NavigationTestIds {
  USER_MENU_TRIGGER = 'navigation-user-menu-trigger',
  SIGNOUT_BUTTON = 'navigation-signout-button',
}

/**
 * Toast notification test IDs
 * Used in: src/lib/toast-helpers.ts, src/components/ui/custom-toast.tsx
 */
export enum ToastTestIds {
  // Auth toasts
  AUTH_SIGNIN_SUCCESS = 'toast-auth-signin-success',
  AUTH_SIGNIN_ERROR = 'toast-auth-signin-error',
  AUTH_SIGNUP_SUCCESS = 'toast-auth-signup-success',
  AUTH_SIGNUP_ERROR = 'toast-auth-signup-error',
  AUTH_SIGNOUT_SUCCESS = 'toast-auth-signout-success',
  AUTH_SIGNOUT_ERROR = 'toast-auth-signout-error',
  AUTH_EMAIL_UNVERIFIED = 'toast-auth-email-unverified',

  // Password reset toasts
  PASSWORD_RESET_SENT_SUCCESS = 'toast-password-reset-sent-success',
  PASSWORD_RESET_SENT_ERROR = 'toast-password-reset-sent-error',
  PASSWORD_UPDATE_SUCCESS = 'toast-password-update-success',
  PASSWORD_UPDATE_ERROR = 'toast-password-update-error',

  // Verify email toasts
  VERIFY_EMAIL_RESEND_SUCCESS = 'toast-verify-email-resend-success',
  VERIFY_EMAIL_RESEND_ERROR = 'toast-verify-email-resend-error',
}

/**
 * Projects page test IDs
 * Used in: src/pages/Projects.tsx
 */
export enum ProjectsTestIds {
  // Page container
  PAGE_CONTAINER = 'projects-page-container',

  // Header
  PAGE_TITLE = 'projects-page-title',
  NEW_PROJECT_BUTTON = 'projects-new-project-button',
  SEARCH_INPUT = 'projects-search-input',

  // Filters
  FILTER_ALL = 'projects-filter-all',
  FILTER_PUBLIC = 'projects-filter-public',
  FILTER_PRIVATE = 'projects-filter-private',

  // Project cards
  PROJECT_CARD = 'projects-project-card',
  PROJECT_TITLE = 'projects-project-title',
  PROJECT_OPEN_BUTTON = 'projects-project-open-button',
  PROJECT_DELETE_BUTTON = 'projects-project-delete-button',
  PROJECT_SHARE_BUTTON = 'projects-project-share-button',
  COLLABORATE_BUTTON = 'projects-collaborate-button',

  // Pagination
  PAGINATION = 'projects-pagination',

  // Empty state
  EMPTY_STATE = 'projects-empty-state',

  // Groups tab
  GROUPS_TAB = 'projects-groups-tab',
  GROUP_SECTION = 'projects-group-section',
  GROUP_SECTION_NAME = 'projects-group-section-name',
}

/**
 * Community page test IDs
 * Used in: src/pages/Community.tsx
 */
export enum CommunityTestIds {
  // Page container
  PAGE_CONTAINER = 'community-page-container',

  // Header
  PAGE_TITLE = 'community-page-title',
  SEARCH_INPUT = 'community-search-input',

  // Sorting/Filters
  SORT_RECENT = 'community-sort-recent',
  SORT_POPULAR = 'community-sort-popular',
  SORT_CLONED = 'community-sort-cloned',
  SORT_LIKED = 'community-sort-liked',

  // Project cards
  PROJECT_CARD = 'community-project-card',
  PROJECT_TITLE = 'community-project-title',
  PROJECT_AUTHOR = 'community-project-author',
  PROJECT_VIEW_BUTTON = 'community-project-view-button',
  PROJECT_LIKE_BUTTON = 'community-project-like-button',
  PROJECT_CLONE_BUTTON = 'community-project-clone-button',

  // Stats
  STATS_TOTAL_PROJECTS = 'community-stats-total-projects',
  STATS_TOTAL_VIEWS = 'community-stats-total-views',
  STATS_TOTAL_LIKES = 'community-stats-total-likes',

  // Pagination
  PAGINATION = 'community-pagination',
}

/**
 * Admin page test IDs
 * Used in: src/pages/Admin.tsx
 */
export enum AdminTestIds {
  // Page container
  PAGE_CONTAINER = 'admin-page-container',

  // Header
  PAGE_TITLE = 'admin-page-title',
  NOTIFICATION_BELL = 'admin-notification-bell',
  NOTIFICATION_COUNT = 'admin-notification-count',

  // Navigation buttons
  AI_SETTINGS_BUTTON = 'admin-ai-settings-button',
  POWERPOINT_BUTTON = 'admin-powerpoint-button',
  RATE_LIMITS_BUTTON = 'admin-rate-limits-button',
  ANALYTICS_BUTTON = 'admin-analytics-button',
  EMAIL_BUTTON = 'admin-email-button',

  // Sections
  SUBMITTED_PROJECTS_SECTION = 'admin-submitted-projects-section',
  TESTIMONIALS_SECTION = 'admin-testimonials-section',
  ICON_SUBMISSIONS_SECTION = 'admin-icon-submissions-section',
  CONTACT_MESSAGES_SECTION = 'admin-contact-messages-section',
  TOOL_FEEDBACK_SECTION = 'admin-tool-feedback-section',

  // Icon Tag Management (CSV)
  CSV_EXPORT_BUTTON = 'admin-csv-export-button',
  CSV_IMPORT_BUTTON = 'admin-csv-import-button',
}

/**
 * Contact page test IDs
 * Used in: src/pages/Contact.tsx
 */
export enum ContactTestIds {
  // Page container
  PAGE_CONTAINER = 'contact-page-container',

  // Form
  FORM = 'contact-form',
  EMAIL_INPUT = 'contact-email-input',
  NAME_INPUT = 'contact-name-input',
  COUNTRY_INPUT = 'contact-country-input',
  MESSAGE_TEXTAREA = 'contact-message-textarea',
  SUBMIT_BUTTON = 'contact-submit-button',

  // Validation
  ERROR_EMAIL = 'contact-error-email',
  ERROR_NAME = 'contact-error-name',
  ERROR_COUNTRY = 'contact-error-country',
  ERROR_MESSAGE = 'contact-error-message',

  // Success
  SUCCESS_MESSAGE = 'contact-success-message',
}

/**
 * Blog page test IDs
 * Used in: src/pages/Blog.tsx
 */
export enum BlogTestIds {
  // Page container
  PAGE_CONTAINER = 'blog-page-container',

  // Header
  PAGE_TITLE = 'blog-page-title',
  SEARCH_INPUT = 'blog-search-input',

  // Post cards
  POST_CARD = 'blog-post-card',
  POST_TITLE = 'blog-post-title',
  POST_EXCERPT = 'blog-post-excerpt',
  POST_READ_MORE = 'blog-post-read-more',

  // Categories/Tags
  CATEGORY_FILTER = 'blog-category-filter',
  TAG_FILTER = 'blog-tag-filter',

  // Pagination
  PAGINATION = 'blog-pagination',
}

/**
 * Author Profile page test IDs
 * Used in: src/pages/AuthorProfile.tsx
 */
export enum AuthorProfileTestIds {
  // Page container
  PAGE_CONTAINER = 'author-profile-page-container',

  // Profile info
  PROFILE_NAME = 'author-profile-name',
  PROFILE_BIO = 'author-profile-bio',
  PROFILE_AVATAR = 'author-profile-avatar',
  PROFILE_COUNTRY = 'author-profile-country',
  PROFILE_FIELD = 'author-profile-field',

  // Stats
  STAT_PROJECTS = 'author-profile-stat-projects',
  STAT_VIEWS = 'author-profile-stat-views',
  STAT_LIKES = 'author-profile-stat-likes',

  // Projects section
  PROJECTS_SECTION = 'author-profile-projects-section',
  PROJECT_CARD = 'author-profile-project-card',
}

/**
 * Canvas Editor test IDs
 * Used in: src/pages/Canvas.tsx, src/components/canvas/*
 */
export enum CanvasEditorTestIds {
  // Page & Canvas
  PAGE_CONTAINER = 'canvas-editor-page-container',
  CANVAS_ELEMENT = 'canvas-editor-canvas-element',
  CANVAS_WRAPPER = 'canvas-editor-canvas-wrapper',

  // Toolbar
  TOOLBAR = 'canvas-editor-toolbar',
  UNDO_BUTTON = 'canvas-editor-undo-button',
  REDO_BUTTON = 'canvas-editor-redo-button',
  SAVE_BUTTON = 'canvas-editor-save-button',

  // Tools
  SELECT_TOOL = 'canvas-editor-select-tool',
  SHAPES_DROPDOWN = 'canvas-editor-shapes-dropdown',
  RECTANGLE_TOOL = 'canvas-editor-rectangle-tool',
  CIRCLE_TOOL = 'canvas-editor-circle-tool',
  TEXT_TOOL = 'canvas-editor-text-tool',
  LINE_TOOL = 'canvas-editor-line-tool',
  IMAGE_BUTTON = 'canvas-editor-image-button',

  // Grid & Snapping
  QUICK_SETTINGS_BUTTON = 'canvas-editor-quick-settings-button', // Deprecated - Quick Settings removed
  GRID_AND_RULERS_BUTTON = 'canvas-editor-grid-and-rulers-button',
  GRID_TOGGLE = 'canvas-editor-grid-toggle',
  SNAP_TO_GRID_TOGGLE = 'canvas-editor-snap-to-grid-toggle',

  // Layers Panel
  LAYERS_PANEL = 'canvas-editor-layers-panel',
  LAYER_ITEM = 'canvas-editor-layer-item',
  LAYER_VISIBILITY_TOGGLE = 'canvas-editor-layer-visibility-toggle',
  LAYER_LOCK_TOGGLE = 'canvas-editor-layer-lock-toggle',

  // Properties Panel
  PROPERTIES_PANEL = 'canvas-editor-properties-panel',
  OBJECT_WIDTH_INPUT = 'canvas-editor-object-width-input',
  OBJECT_HEIGHT_INPUT = 'canvas-editor-object-height-input',
  OBJECT_X_INPUT = 'canvas-editor-object-x-input',
  OBJECT_Y_INPUT = 'canvas-editor-object-y-input',

  // Selection & Grouping
  SELECTED_OBJECT = 'canvas-editor-selected-object',
  MULTI_SELECTION = 'canvas-editor-multi-selection',
  GROUP_BUTTON = 'canvas-editor-group-button',
  UNGROUP_BUTTON = 'canvas-editor-ungroup-button',

  // Premium Features (Milestone B)
  AI_ICON_BUTTON = 'canvas-editor-ai-icon-button',
  POWERPOINT_BUTTON = 'canvas-editor-powerpoint-button',
  SHARE_BUTTON = 'canvas-editor-share-button',
  PREMIUM_POPOVER = 'canvas-editor-premium-popover',
  PREMIUM_PROGRESS_TEXT = 'canvas-editor-premium-progress-text',
  PREMIUM_PROGRESS_BAR = 'canvas-editor-premium-progress-bar',
  PREMIUM_SHARE_BUTTON = 'canvas-editor-premium-share-button',
  PUBLISH_PROJECT_DIALOG = 'canvas-editor-publish-project-dialog',

  // Zoom Control Popover (Milestone C)
  ZOOM_IN_BUTTON = 'canvas-editor-zoom-in-button',
  ZOOM_OUT_BUTTON = 'canvas-editor-zoom-out-button',
  ZOOM_FIT_BUTTON = 'canvas-editor-zoom-fit-button',
  ZOOM_PERCENTAGE_BUTTON = 'canvas-editor-zoom-percentage-button',
  ZOOM_POPOVER = 'canvas-editor-zoom-popover',
  ZOOM_PRESET_25 = 'canvas-editor-zoom-preset-25',
  ZOOM_PRESET_50 = 'canvas-editor-zoom-preset-50',
  ZOOM_PRESET_75 = 'canvas-editor-zoom-preset-75',
  ZOOM_PRESET_100 = 'canvas-editor-zoom-preset-100',
  ZOOM_PRESET_150 = 'canvas-editor-zoom-preset-150',
  ZOOM_PRESET_200 = 'canvas-editor-zoom-preset-200',
  ZOOM_PRESET_400 = 'canvas-editor-zoom-preset-400',
  ZOOM_CUSTOM_INPUT = 'canvas-editor-zoom-custom-input',

  // Style Presets (Milestone C)
  STYLE_PRESETS_SECTION = 'canvas-editor-style-presets-section',
  STYLE_PRESETS_SAVE_BUTTON = 'canvas-editor-style-presets-save-button',
  STYLE_PRESETS_PRESET_BUTTON = 'canvas-editor-style-presets-preset-button',
  STYLE_PRESETS_SAVE_DIALOG = 'canvas-editor-style-presets-save-dialog',
  STYLE_PRESETS_NAME_INPUT = 'canvas-editor-style-presets-name-input',
  STYLE_PRESETS_SAVE_DIALOG_BUTTON = 'canvas-editor-style-presets-save-dialog-button',

  // Command Palette (Milestone C)
  COMMAND_PALETTE_DIALOG = 'canvas-editor-command-palette-dialog',
  COMMAND_PALETTE_INPUT = 'canvas-editor-command-palette-input',
  COMMAND_PALETTE_ITEM = 'canvas-editor-command-palette-item',
  COMMAND_PALETTE_RECENT_GROUP = 'canvas-editor-command-palette-recent-group',

  // Real-time Collaboration (Milestone 3)
  PRESENCE_AVATARS = 'canvas-editor-presence-avatars',
  PRESENCE_AVATAR = 'canvas-editor-presence-avatar',
  LOCK_BANNER = 'canvas-editor-lock-banner',
  LOCK_BUTTON = 'canvas-editor-lock-button',
  UNLOCK_BUTTON = 'canvas-editor-unlock-button',
  COMMENT_TOOL = 'canvas-editor-comment-tool',
  COMMENT_SIDEBAR_TOGGLE = 'canvas-editor-comment-sidebar-toggle',
}

/**
 * Icon Library test IDs
 * Used in: src/components/canvas/IconLibrary.tsx
 */
export enum IconLibraryTestIds {
  LIBRARY_PANEL = 'icon-library-panel',
  LIBRARY_TOGGLE = 'icon-library-toggle', // Deprecated - now uses tabs
  ICONS_TAB = 'icon-library-icons-tab',
  ASSETS_TAB = 'icon-library-assets-tab',
  SEARCH_INPUT = 'icon-library-search-input',
  CATEGORY_FILTER = 'icon-library-category-filter',
  ICON_ITEM = 'icon-library-icon-item',
  UPLOAD_BUTTON = 'icon-library-upload-button',
  UPLOAD_DIALOG = 'icon-library-upload-dialog',
  UPLOAD_FILE_INPUT = 'icon-library-upload-file-input',
  DELETE_ICON_BUTTON = 'icon-library-delete-icon-button',
  LOADING_INDICATOR = 'icon-library-loading-indicator',

  // AI Generated Icons Section (Milestone B)
  AI_SECTION = 'icon-library-ai-section',
  AI_GENERATE_BUTTON = 'icon-library-ai-generate-button',
  AI_COMMUNITY_TAB = 'icon-library-ai-community-tab',
  AI_MY_ICONS_TAB = 'icon-library-ai-my-icons-tab',

  // Pagination (Milestone 1)
  PAGINATION_CONTROLS = 'pagination-controls',
  PAGINATION_PREVIOUS = 'pagination-previous',
  PAGINATION_NEXT = 'pagination-next',
  PAGINATION_INDICATOR = 'pagination-indicator',
}

/**
 * Export Dialog test IDs
 * Used in: src/components/canvas/ExportDialog.tsx
 */
export enum ExportDialogTestIds {
  DIALOG = 'export-dialog',
  DIALOG_TRIGGER = 'export-dialog-trigger',

  // Format selection
  FORMAT_PNG = 'export-format-png',
  FORMAT_JPEG = 'export-format-jpeg',
  FORMAT_SVG = 'export-format-svg',
  FORMAT_PDF = 'export-format-pdf',

  // DPI options
  DPI_150 = 'export-dpi-150',
  DPI_300 = 'export-dpi-300',
  DPI_600 = 'export-dpi-600',

  // JPEG quality
  QUALITY_SLIDER = 'export-quality-slider',
  QUALITY_VALUE = 'export-quality-value',

  // PDF options
  CMYK_MODE_TOGGLE = 'export-cmyk-mode-toggle',

  // Export button
  EXPORT_BUTTON = 'export-export-button',
  CANCEL_BUTTON = 'export-cancel-button',
}

/**
 * Canvas Size Dialog test IDs
 * Used in: src/components/canvas/CustomCanvasDialog.tsx
 */
export enum CanvasSizeTestIds {
  SIZE_DIALOG = 'canvas-size-dialog',
  SIZE_DIALOG_TRIGGER = 'canvas-size-dialog-trigger',
  PAPER_SIZE_SELECT = 'canvas-size-paper-size-select',

  // Dimensions
  WIDTH_INPUT = 'canvas-size-width-input',
  HEIGHT_INPUT = 'canvas-size-height-input',

  // Units
  UNIT_SELECT = 'canvas-size-unit-select',
  UNIT_INCHES = 'canvas-size-unit-inches',
  UNIT_CM = 'canvas-size-unit-cm',
  UNIT_PX = 'canvas-size-unit-px',

  // Actions
  APPLY_BUTTON = 'canvas-size-apply-button',
  CANCEL_BUTTON = 'canvas-size-cancel-button',
}

/**
 * Annotation Tools test IDs
 * Used in: src/components/canvas/AnnotationTools.tsx
 */
export enum AnnotationTestIds {
  // Dropdown trigger
  DROPDOWN_TRIGGER = 'annotation-tools-dropdown-trigger',

  // Numbered callouts
  CALLOUT_TOOL = 'annotation-callout-tool',
  CALLOUT_NUMBER = 'annotation-callout-number',

  // Leader lines
  LEADER_LINE_TOOL = 'annotation-leader-line-tool',
  LEADER_LINE_TEXT = 'annotation-leader-line-text',

  // Presets
  PRESET_ARROW_TEXT = 'annotation-preset-arrow-text',
  PRESET_BRACKET_LABEL = 'annotation-preset-bracket-label',

  // Legend generator
  LEGEND_GENERATOR_BUTTON = 'annotation-legend-generator-button',
  LEGEND_OUTPUT = 'annotation-legend-output',
}

/**
 * Share Dialog test IDs
 * Used in: src/components/projects/ShareDialog.tsx
 */
export enum ShareDialogTestIds {
  DIALOG = 'share-dialog',
  DIALOG_TRIGGER = 'share-dialog-trigger',
  SHARE_URL = 'share-share-url',
  COPY_LINK_BUTTON = 'share-copy-link-button',
  PUBLIC_TOGGLE = 'share-public-toggle',
}

/**
 * Chart Tool test IDs
 * Used in: src/components/canvas/Toolbar.tsx, src/components/canvas/properties/ChartPropertiesSection.tsx
 */
export enum ChartTestIds {
  // Toolbar
  CHART_TOOL = 'canvas-editor-chart-tool',

  // Data Dialog
  EDIT_DATA_BUTTON = 'chart-properties-edit-data-button',
  DATA_DIALOG = 'chart-data-dialog',
  PASTE_CSV_BUTTON = 'chart-data-paste-csv',
  UPLOAD_CSV_BUTTON = 'chart-data-upload-csv',
  DATA_CELL = 'chart-data-cell',
  DATA_DIALOG_CLOSE = 'chart-data-dialog-close',

  // Type & Mapping
  CHART_TYPE_SELECT = 'chart-properties-type-select',
  X_AXIS_SELECT = 'chart-properties-x-axis-select',
  Y_AXIS_CHECKBOX = 'chart-properties-y-axis-checkbox',
  ERROR_BARS_CHECKBOX = 'chart-properties-error-bars-checkbox',
  ERROR_BAR_SELECT = 'chart-properties-error-bar-select',

  // Style
  TITLE_INPUT = 'chart-properties-title-input',
  X_AXIS_LABEL_INPUT = 'chart-properties-x-axis-label-input',
  Y_AXIS_LABEL_INPUT = 'chart-properties-y-axis-label-input',
  SERIES_COLOR_PICKER = 'chart-properties-series-color',
  SHOW_LEGEND_CHECKBOX = 'chart-properties-show-legend',
}

/**
 * Crop Tool test IDs
 * Used in: src/components/canvas/properties/ImagePropertiesSection.tsx, src/components/canvas/CropTool.tsx
 */
export enum CropTestIds {
  // Properties Panel Buttons - Uncropped Image
  CROP_RECTANGLE_BUTTON = 'crop-rectangle-button',
  CROP_SQUARE_BUTTON = 'crop-square-button',
  CROP_ELLIPSE_BUTTON = 'crop-ellipse-button',
  CROP_CIRCLE_BUTTON = 'crop-circle-button',
  CROP_FREEFORM_BUTTON = 'crop-freeform-button',

  // Properties Panel Buttons - Cropped Image
  EDIT_CROP_BUTTON = 'edit-crop-button',
  RESET_CROP_BUTTON = 'reset-crop-button',

  // Lightbox UI
  CROP_LIGHTBOX = 'crop-lightbox',
  CROP_MODE_SELECT = 'crop-mode-select',
  CROP_DIMENSIONS = 'crop-dimensions',
  DELETE_POINT_BUTTON = 'delete-point-button',
  APPLY_CROP_BUTTON = 'apply-crop-button',
  CANCEL_CROP_BUTTON = 'cancel-crop-button',

  // Crop Handles (for rect/circle/ellipse/square)
  CROP_HANDLE_TL = 'crop-handle-tl',
  CROP_HANDLE_TR = 'crop-handle-tr',
  CROP_HANDLE_BL = 'crop-handle-bl',
  CROP_HANDLE_BR = 'crop-handle-br',

  // Polygon Points (for freeform)
  POLYGON_POINT = 'polygon-point',
  POLYGON_DRAGGABLE = 'polygon-draggable',
}

/**
 * Groups page test IDs
 * Used in: src/pages/Groups.tsx
 */
export enum GroupsTestIds {
  PAGE_CONTAINER = 'groups-page-container',
  PAGE_TITLE = 'groups-page-title',
  NEW_GROUP_BUTTON = 'groups-new-group-button',
  GROUP_CARD = 'groups-group-card',
  GROUP_NAME = 'groups-group-name',
  GROUP_ROLE_BADGE = 'groups-group-role-badge',
  GROUP_OPEN_BUTTON = 'groups-group-open-button',
  EMPTY_STATE = 'groups-empty-state',
}

/**
 * Group Detail page test IDs
 * Used in: src/pages/GroupDetail.tsx
 */
export enum GroupDetailTestIds {
  PAGE_CONTAINER = 'group-detail-page-container',
  GROUP_NAME = 'group-detail-group-name',
  ROLE_BADGE = 'group-detail-role-badge',
  INVITE_BUTTON = 'group-detail-invite-button',
  MEMBER_ROW = 'group-detail-member-row',
  MEMBER_NAME = 'group-detail-member-name',
  MEMBER_ROLE_BADGE = 'group-detail-member-role-badge',
  REMOVE_MEMBER_BUTTON = 'group-detail-remove-member-button',
  PENDING_INVITE_ROW = 'group-detail-pending-invite-row',
  PENDING_INVITE_EMAIL = 'group-detail-pending-invite-email',
  COPY_INVITE_LINK_BUTTON = 'group-detail-copy-invite-link-button',
  RESEND_INVITE_BUTTON = 'group-detail-resend-invite-button',
  REVOKE_INVITE_BUTTON = 'group-detail-revoke-invite-button',
  SETTINGS_NAME_INPUT = 'group-detail-settings-name-input',
  SETTINGS_DESCRIPTION_INPUT = 'group-detail-settings-description-input',
  SETTINGS_SAVE_BUTTON = 'group-detail-settings-save-button',
  DELETE_GROUP_BUTTON = 'group-detail-delete-group-button',

  // Projects tab
  PROJECTS_TAB = 'group-detail-projects-tab',
  PROJECT_ROW = 'group-detail-project-row',
  ADD_PROJECT_BUTTON = 'group-detail-add-project-button',
  NEW_PROJECT_BUTTON = 'group-detail-new-project-button',

  // Pages tab
  PAGES_TAB = 'group-detail-pages-tab',
  PAGE_ROW = 'group-detail-page-row',
  ADD_PAGE_BUTTON = 'group-detail-add-page-button',
  NEW_PAGE_BUTTON = 'group-detail-new-page-button',
}

/**
 * Create Group Dialog test IDs
 * Used in: src/components/collaboration/CreateGroupDialog.tsx
 */
export enum CreateGroupDialogTestIds {
  DIALOG = 'create-group-dialog',
  NAME_INPUT = 'create-group-name-input',
  DESCRIPTION_INPUT = 'create-group-description-input',
  SUBMIT_BUTTON = 'create-group-submit-button',
  CANCEL_BUTTON = 'create-group-cancel-button',
}

/**
 * Invite Group Member Dialog test IDs
 * Used in: src/components/collaboration/InviteGroupMemberDialog.tsx
 */
export enum InviteGroupMemberDialogTestIds {
  DIALOG = 'invite-group-member-dialog',
  EMAIL_INPUT = 'invite-group-member-email-input',
  ROLE_SELECT = 'invite-group-member-role-select',
  SUBMIT_BUTTON = 'invite-group-member-submit-button',
  CANCEL_BUTTON = 'invite-group-member-cancel-button',
}

/**
 * Collaborate Dialog test IDs
 * Used in: src/components/collaboration/CollaborateDialog.tsx
 */
export enum CollaborateDialogTestIds {
  DIALOG = 'collaborate-dialog',
  EMAIL_INPUT = 'collaborate-email-input',
  PERMISSION_SELECT = 'collaborate-permission-select',
  INVITE_BUTTON = 'collaborate-invite-button',
  GROUP_SELECT = 'collaborate-group-select',
  GROUP_PERMISSION_SELECT = 'collaborate-group-permission-select',
  GROUP_SHARE_BUTTON = 'collaborate-group-share-button',
  GROUP_ACCESS_ROW = 'collaborate-group-access-row',
  COLLABORATOR_ROW = 'collaborate-collaborator-row',
  COLLABORATOR_STATUS_BADGE = 'collaborate-collaborator-status-badge',
  COPY_INVITE_LINK_BUTTON = 'collaborate-copy-invite-link-button',
  RESEND_INVITE_BUTTON = 'collaborate-resend-invite-button',
  REMOVE_COLLABORATOR_BUTTON = 'collaborate-remove-collaborator-button',
}

/**
 * Accept Invitation page test IDs
 * Used in: src/pages/AcceptGroupInvitation.tsx, src/pages/AcceptProjectInvitation.tsx, src/pages/AcceptPageInvitation.tsx
 */
export enum AcceptInvitationTestIds {
  PAGE_CONTAINER = 'accept-invitation-page-container',
  INVITATION_DETAILS = 'accept-invitation-details',
  ACCEPT_BUTTON = 'accept-invitation-accept-button',
  DECLINE_BUTTON = 'accept-invitation-decline-button',
  SIGNIN_BUTTON = 'accept-invitation-signin-button',
  EXPIRED_MESSAGE = 'accept-invitation-expired-message',
  ALREADY_ACCEPTED_MESSAGE = 'accept-invitation-already-accepted-message',
  ERROR_MESSAGE = 'accept-invitation-error-message',
}

/**
 * Pages list page test IDs
 * Used in: src/pages/Pages.tsx
 */
export enum PagesTestIds {
  PAGE_CONTAINER = 'pages-page-container',
  NEW_PAGE_BUTTON = 'pages-new-page-button',
  PAGE_CARD = 'pages-page-card',
  PAGE_NAME = 'pages-page-name',
  MY_PAGES_SECTION = 'pages-my-pages-section',
  SHARED_PAGES_SECTION = 'pages-shared-pages-section',
  EMPTY_STATE = 'pages-empty-state',
}

/**
 * Page Detail page test IDs
 * Used in: src/pages/PageDetail.tsx
 */
export enum PageDetailTestIds {
  PAGE_CONTAINER = 'page-detail-page-container',
  PAGE_NAME = 'page-detail-page-name',
  EDIT_NAME_BUTTON = 'page-detail-edit-name-button',
  EDIT_NAME_INPUT = 'page-detail-edit-name-input',
  DELETE_PAGE_BUTTON = 'page-detail-delete-page-button',
  ADD_PROJECTS_BUTTON = 'page-detail-add-projects-button',
  NEW_PROJECT_BUTTON = 'page-detail-new-project-button',
  SHARE_BUTTON = 'page-detail-share-button',
  PROJECT_CARD = 'page-detail-project-card',

  // Share dialog (inline within PageDetail)
  SHARE_DIALOG = 'page-detail-share-dialog',
  GROUP_ACCESS_ROW = 'page-detail-group-access-row',
  INVITE_ROW = 'page-detail-invite-row',
  INVITE_EMAIL_INPUT = 'page-detail-invite-email-input',
  INVITE_PERMISSION_SELECT = 'page-detail-invite-permission-select',
  INVITE_SUBMIT_BUTTON = 'page-detail-invite-submit-button',
  GROUP_SELECT = 'page-detail-group-select',
  GROUP_PERMISSION_SELECT = 'page-detail-group-permission-select',
  GROUP_SHARE_BUTTON = 'page-detail-group-share-button',
  COPY_INVITE_LINK_BUTTON = 'page-detail-copy-invite-link-button',
  RESEND_INVITE_BUTTON = 'page-detail-resend-invite-button',
  REMOVE_INVITE_BUTTON = 'page-detail-remove-invite-button',
  REMOVE_GROUP_ACCESS_BUTTON = 'page-detail-remove-group-access-button',
}

/**
 * Create Page Dialog test IDs
 * Used in: src/components/collaboration/CreatePageDialog.tsx
 */
export enum CreatePageDialogTestIds {
  DIALOG = 'create-page-dialog',
  NAME_INPUT = 'create-page-name-input',
  DESCRIPTION_INPUT = 'create-page-description-input',
  SUBMIT_BUTTON = 'create-page-submit-button',
  CANCEL_BUTTON = 'create-page-cancel-button',
}

/**
 * Profile page — Notification Settings test IDs
 * Used in: src/pages/Profile.tsx
 */
export enum ProfileTestIds {
  NOTIFICATION_SETTINGS_CARD = 'profile-notification-settings-card',
  NOTIF_TOGGLE_IN_APP        = 'profile-notif-toggle-in-app',
  NOTIF_TOGGLE_EMAIL         = 'profile-notif-toggle-email',
  NOTIF_SAVE_BUTTON          = 'profile-notif-save-button',
}

export enum TemplatesBrowserTestIds {
  PANEL              = 'templates-browser-panel',
  COMMUNITY_TAB      = 'templates-browser-community-tab',
  BRUSHES_TAB        = 'templates-browser-brushes-tab',
  MY_PROJECTS_TAB    = 'templates-browser-my-projects-tab',
  SEARCH_INPUT       = 'templates-browser-search-input',
  SORT_SELECT        = 'templates-browser-sort-select',
  PROJECT_CARD       = 'templates-browser-project-card',
  REPLACE_BUTTON     = 'templates-browser-replace-button',
  ADD_TO_CANVAS_BUTTON = 'templates-browser-add-to-canvas-button',
  LOADING_SKELETON   = 'templates-browser-loading-skeleton',
  EMPTY_STATE        = 'templates-browser-empty-state',
}
