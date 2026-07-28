package id.ykn.tv;

import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.Base64;
import android.util.LruCache;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.BufferedInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.Normalizer;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String RAW_EVENTS_URL =
            "https://raw.githubusercontent.com/movietrailersxxi-pixel/web/main/assets/tv-events.dat";
    private static final String RAW_TV_SPORTS_URL =
            "https://raw.githubusercontent.com/movietrailersxxi-pixel/web/main/assets/tv-sports.dat";
    private static final String RAW_TV_HIBURAN_URL =
            "https://raw.githubusercontent.com/movietrailersxxi-pixel/web/main/assets/tv-hiburan.dat";
    private static final String BOT_EVENTS_URL = "https://api.ykn.my.id/api/sports/events";
    private static final String BOT_TV_SPORTS_URL = "https://api.ykn.my.id/api/sports/tv";
    private static final String BOT_TV_HIBURAN_URL = "https://api.ykn.my.id/api/sports/hiburan";
    private static final String ESPORTEX_STREAMS_URL = "https://api.esportex.site/api/streams";
    private static final String PROXY_BASE_URL = "https://proxy-ykntv414.ykn.my.id/api/proxy";
    private static final String LOCAL_PLAYER_BASE = "https://ykn.local/player/";
    private static final String COMMUNITY_URL = "https://whatsapp.com/channel/0029Vb8VPpIAjPXPX2SYKN2P";
    private static final String SAWERIA_URL = "https://saweria.co/diaw14";
    private static final String BAGIBAGI_URL = "https://bagibagi.co/Diaww";
    private static final String KOFI_URL = "https://ko-fi.com/diaww14";
    private static final String PREFS_NAME = "ykn_tv_prefs";
    private static final String CACHE_MAIN_ITEMS = "cache_main_items";
    private static final String CACHE_CHANNEL_ITEMS = "cache_channel_items";
    private static final String CACHE_ESPORTEX_ITEMS = "cache_esportex_items";
    private static final String CACHE_UPDATED_AT = "cache_updated_at";
    private static final long MAIN_CACHE_BUST_MS = 5_000L;
    private static final long ESPORTEX_CACHE_BUST_MS = 30_000L;
    private static final long SCHEDULE_REFRESH_MS = 5_000L;
    private static final long MAIN_DEFAULT_EVENT_DURATION_MS = 2L * 60L * 60L * 1000L;
    private static final long ESPORTEX_DEFAULT_EVENT_DURATION_MS = 3L * 60L * 60L * 1000L;
    private static final long MAIN_LIVE_GRACE_MS = 30L * 60L * 1000L;
    private static final long OFFLINE_TOAST_INTERVAL_MS = 30_000L;
    private static final long PLAYER_LOAD_HOLD_MS = 140L;

    private static final int C_BLACK = Color.rgb(2, 2, 2);
    private static final int C_SURFACE = Color.rgb(8, 8, 8);
    private static final int C_SURFACE_2 = Color.rgb(18, 18, 18);
    private static final int C_PANEL = Color.rgb(10, 10, 10);
    private static final int C_GOLD = Color.rgb(212, 175, 55);
    private static final int C_EMERALD = Color.rgb(16, 185, 129);
    private static final int C_RED = Color.rgb(229, 9, 20);
    private static final int C_WHITE = Color.WHITE;
    private static final int C_MUTED = Color.rgb(161, 161, 170);
    private static final int C_DIM = Color.rgb(82, 82, 91);

    private static final String[] SPONSOR_URLS = {
            "https://www.effectivecpmnetwork.com/y1eyn99g?key=a90145a7b7e54a1196a76d83553b473d",
            "https://omg10.com/4/11195650"
    };
    private static final double PRIMARY_SPONSOR_WEIGHT = 0.82d;

    private static final SportTab[] SPORT_TABS = {
            new SportTab("main", "Jadwal"),
            new SportTab("tv_sports", "TV Sports"),
            new SportTab("tv_hiburan", "Hiburan"),
            new SportTab("football", "Bola"),
            new SportTab("basketball", "Basket"),
            new SportTab("amfootball", "Am. Football"),
            new SportTab("baseball", "Baseball"),
            new SportTab("badminton", "Bulu Tangkis"),
            new SportTab("volleyball", "Bola Voli"),
            new SportTab("tennis", "Tenis"),
            new SportTab("race", "Balapan"),
            new SportTab("fight", "Combat"),
            new SportTab("hockey", "Hockey"),
            new SportTab("rugby", "Rugby"),
            new SportTab("cricket", "Cricket"),
            new SportTab("other", "Lainnya")
    };

    private static final Set<String> AD_HOST_KEYWORDS = new HashSet<>(Arrays.asList(
            "omg10.com",
            "effectivecpmnetwork.com",
            "monetag",
            "propeller",
            "doubleclick.net",
            "googlesyndication.com",
            "googleadservices.com",
            "adsterra",
            "popads",
            "popcash",
            "adnxs.com",
            "exoclick",
            "taboola",
            "outbrain"
    ));

    private static boolean sponsorShownThisSession = false;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService scheduleExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService imageExecutor = Executors.newFixedThreadPool(3);
    private final TimeZone userDisplayTimeZone = resolveUserIndonesianTimeZone();
    private final Locale indonesianLocale = new Locale("id", "ID");
    private final LruCache<String, Bitmap> imageCache = new LruCache<String, Bitmap>(8 * 1024) {
        @Override
        protected int sizeOf(String key, Bitmap value) {
            return Math.max(1, value.getByteCount() / 1024);
        }
    };

    private FrameLayout rootFrame;
    private LinearLayout appContent;
    private View headerView;
    private FrameLayout playerShell;
    private WebView playerView;
    private LinearLayout nowRow;
    private HorizontalScrollView serverScroller;
    private HorizontalScrollView tabScroller;
    private ScrollView scheduleScroll;
    private View footerView;
    private LinearLayout tabContainer;
    private LinearLayout serverContainer;
    private LinearLayout scheduleContainer;
    private TextView nowPlayingTitle;
    private TextView nowPlayingMeta;
    private TextView loadingLabel;

    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    private final List<ScheduleItem> mainItems = new ArrayList<>();
    private final List<ScheduleItem> channelItems = new ArrayList<>();
    private final List<ScheduleItem> esportexItems = new ArrayList<>();
    private String activeSport = "main";
    private ScheduleItem selectedItem;
    private int selectedServerIndex = 0;
    private boolean isLoadingSchedules = false;
    private boolean refreshLoopRunning = false;
    private String currentLoadedSignature = "";
    private String playerLogoDataUri = "";
    private long lastOfflineToastAt = 0L;
    private final Runnable refreshRunnable = new Runnable() {
        @Override
        public void run() {
            if (!refreshLoopRunning) return;
            loadSchedules(true);
            mainHandler.postDelayed(this, SCHEDULE_REFRESH_MS);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(C_BLACK);
        getWindow().setNavigationBarColor(C_BLACK);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        buildUi();
        installSystemInsetPadding();
        setupPlayer();
        loadPlaceholder("YKN TV", "Loading live schedule...");
        loadSchedules(false);
        showSponsorDialogIfNeeded();
    }

    @Override
    protected void onResume() {
        super.onResume();
        startRefreshLoop();
    }

    @Override
    protected void onPause() {
        super.onPause();
        stopRefreshLoop();
    }

    @Override
    protected void onDestroy() {
        stopRefreshLoop();
        if (isFinishing()) {
            sponsorShownThisSession = false;
        }
        if (playerView != null) {
            playerView.stopLoading();
            playerView.destroy();
        }
        scheduleExecutor.shutdownNow();
        imageExecutor.shutdownNow();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (fullscreenView != null) {
            hideFullscreenView();
            return;
        }
        super.onBackPressed();
    }

    private void buildUi() {
        rootFrame = new FrameLayout(this);
        rootFrame.setBackgroundColor(C_BLACK);

        appContent = new LinearLayout(this);
        appContent.setOrientation(LinearLayout.VERTICAL);
        appContent.setBackgroundColor(C_BLACK);
        rootFrame.addView(appContent, matchFrame());
        setContentView(rootFrame);

        headerView = buildHeader();
        appContent.addView(headerView, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(54)
        ));

        playerShell = new FrameLayout(this);
        playerShell.setPadding(0, 0, 0, 0);
        playerShell.setBackground(playerChrome());
        playerShell.setClipToOutline(true);
        playerShell.setElevation(dp(2));
        appContent.addView(playerShell, normalPlayerLayoutParams());

        playerView = new WebView(this);
        playerView.setBackgroundColor(Color.BLACK);
        playerView.setKeepScreenOn(true);
        playerShell.addView(playerView, matchFrame());

        nowRow = new LinearLayout(this);
        nowRow.setOrientation(LinearLayout.VERTICAL);
        nowRow.setPadding(dp(14), dp(0), dp(14), dp(8));
        appContent.addView(nowRow, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        nowPlayingTitle = new TextView(this);
        nowPlayingTitle.setTextColor(C_WHITE);
        nowPlayingTitle.setTypeface(Typeface.DEFAULT_BOLD);
        nowPlayingTitle.setTextSize(14);
        nowPlayingTitle.setSingleLine(true);
        nowPlayingTitle.setEllipsize(TextUtils.TruncateAt.END);
        nowRow.addView(nowPlayingTitle);

        nowPlayingMeta = new TextView(this);
        nowPlayingMeta.setTextColor(C_MUTED);
        nowPlayingMeta.setTypeface(Typeface.DEFAULT_BOLD);
        nowPlayingMeta.setTextSize(10);
        nowPlayingMeta.setSingleLine(true);
        nowPlayingMeta.setEllipsize(TextUtils.TruncateAt.END);
        nowRow.addView(nowPlayingMeta);

        serverScroller = new HorizontalScrollView(this);
        serverScroller.setHorizontalScrollBarEnabled(false);
        serverContainer = new LinearLayout(this);
        serverContainer.setOrientation(LinearLayout.HORIZONTAL);
        serverContainer.setGravity(Gravity.CENTER_VERTICAL);
        serverContainer.setPadding(dp(12), dp(0), dp(12), dp(10));
        serverScroller.addView(serverContainer);
        appContent.addView(serverScroller, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        tabScroller = new HorizontalScrollView(this);
        tabScroller.setHorizontalScrollBarEnabled(false);
        tabContainer = new LinearLayout(this);
        tabContainer.setOrientation(LinearLayout.HORIZONTAL);
        tabContainer.setGravity(Gravity.CENTER_VERTICAL);
        tabContainer.setPadding(dp(12), dp(0), dp(12), dp(9));
        tabScroller.addView(tabContainer);
        appContent.addView(tabScroller, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        loadingLabel = new TextView(this);
        loadingLabel.setTextColor(C_MUTED);
        loadingLabel.setTypeface(Typeface.DEFAULT_BOLD);
        loadingLabel.setTextSize(10);
        loadingLabel.setGravity(Gravity.CENTER);
        loadingLabel.setVisibility(View.GONE);
        appContent.addView(loadingLabel, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        scheduleScroll = new ScrollView(this);
        scheduleScroll.setFillViewport(false);
        scheduleContainer = new LinearLayout(this);
        scheduleContainer.setOrientation(LinearLayout.VERTICAL);
        scheduleContainer.setPadding(dp(12), dp(1), dp(12), dp(18));
        scheduleScroll.addView(scheduleContainer);
        appContent.addView(scheduleScroll, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
        ));

        footerView = buildFooter();
        appContent.addView(footerView, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));
    }

    private View buildHeader() {
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(12), dp(5), dp(12), dp(5));
        header.setBackgroundColor(Color.rgb(3, 3, 3));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.ykn_tv_logo);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams logoLp = new LinearLayout.LayoutParams(dp(104), dp(32));
        header.addView(logo, logoLp);

        TextView liveBadge = new TextView(this);
        liveBadge.setText("LIVE HUB");
        liveBadge.setTextColor(C_BLACK);
        liveBadge.setTextSize(9);
        liveBadge.setTypeface(Typeface.DEFAULT_BOLD);
        liveBadge.setGravity(Gravity.CENTER);
        liveBadge.setPadding(dp(7), dp(3), dp(7), dp(3));
        liveBadge.setBackground(stroked(C_GOLD, C_GOLD, 1, 9));
        LinearLayout.LayoutParams badgeLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        badgeLp.setMargins(dp(8), 0, 0, 0);
        header.addView(liveBadge, badgeLp);

        View spacer = new View(this);
        header.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));

        TextView refresh = new TextView(this);
        refresh.setText("REFRESH");
        refresh.setTextColor(C_WHITE);
        refresh.setTextSize(10);
        refresh.setTypeface(Typeface.DEFAULT_BOLD);
        refresh.setGravity(Gravity.CENTER);
        refresh.setPadding(dp(10), dp(7), dp(10), dp(7));
        refresh.setBackground(stroked(Color.argb(18, 255, 255, 255), Color.argb(22, 255, 255, 255), 1, 12));
        refresh.setOnClickListener(v -> loadSchedules(false));
        header.addView(refresh);
        return header;
    }

    private void installSystemInsetPadding() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT_WATCH) return;

        rootFrame.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 35) {
                appContent.setPadding(
                        0,
                        insets.getSystemWindowInsetTop(),
                        0,
                        insets.getSystemWindowInsetBottom()
                );
            }
            return insets;
        });
        rootFrame.requestApplyInsets();
    }

    private View buildFooter() {
        LinearLayout footer = new LinearLayout(this);
        footer.setOrientation(LinearLayout.VERTICAL);
        footer.setPadding(dp(8), dp(6), dp(8), dp(8));
        footer.setBackgroundColor(Color.rgb(3, 3, 3));

        LinearLayout pill = new LinearLayout(this);
        pill.setOrientation(LinearLayout.HORIZONTAL);
        pill.setGravity(Gravity.CENTER_VERTICAL);
        pill.setPadding(dp(8), dp(5), dp(6), dp(5));
        pill.setBackground(stroked(Color.argb(235, 8, 8, 8), Color.argb(52, 212, 175, 55), 1, 24));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.ykn_tv_logo);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams logoLp = new LinearLayout.LayoutParams(dp(50), dp(18));
        logoLp.setMargins(0, 0, dp(7), 0);
        pill.addView(logo, logoLp);

        TextView credit = new TextView(this);
        credit.setText("Developed by YKN Team");
        credit.setTextColor(C_MUTED);
        credit.setTypeface(Typeface.DEFAULT_BOLD);
        credit.setTextSize(8.5f);
        credit.setSingleLine(true);
        credit.setEllipsize(TextUtils.TruncateAt.END);
        pill.addView(credit, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        View community = footerActionButton("Join", R.drawable.ic_users, C_EMERALD, Color.argb(22, 16, 185, 129));
        community.setOnClickListener(v -> openExternalUrl(COMMUNITY_URL));
        LinearLayout.LayoutParams communityLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        communityLp.setMargins(dp(6), 0, 0, 0);
        pill.addView(community, communityLp);

        View support = footerActionButton("Support", R.drawable.ic_coffee, C_GOLD, Color.argb(24, 212, 175, 55));
        support.setOnClickListener(v -> showSupportDialog());
        LinearLayout.LayoutParams supportLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        supportLp.setMargins(dp(6), 0, 0, 0);
        pill.addView(support, supportLp);

        footer.addView(pill, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        return footer;
    }

    private View footerActionButton(String title, int iconRes, int accent, int fillColor) {
        LinearLayout button = new LinearLayout(this);
        button.setOrientation(LinearLayout.HORIZONTAL);
        button.setGravity(Gravity.CENTER_VERTICAL);
        button.setMinimumHeight(dp(31));
        button.setPadding(dp(9), dp(6), dp(10), dp(6));
        button.setBackground(stroked(fillColor, withAlpha(accent, 105), 1, 18));

        ImageView icon = new ImageView(this);
        icon.setImageResource(iconRes);
        icon.setColorFilter(accent);
        LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(dp(15), dp(15));
        iconLp.setMargins(0, 0, dp(5), 0);
        button.addView(icon, iconLp);

        TextView label = new TextView(this);
        label.setText(title);
        label.setTextColor(C_WHITE);
        label.setTypeface(Typeface.DEFAULT_BOLD);
        label.setTextSize(9.5f);
        label.setSingleLine(true);
        button.addView(label);

        return button;
    }

    private void setupPlayer() {
        WebView.setWebContentsDebuggingEnabled(false);

        WebSettings settings = playerView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setSafeBrowsingEnabled(true);

        playerView.addJavascriptInterface(new NativeBridge(), "YknNative");
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(playerView, false);

        playerView.setWebViewClient(new GuardedPlayerClient());
        playerView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                return false;
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fullscreenView = view;
                fullscreenView.setKeepScreenOn(true);
                fullscreenCallback = callback;
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                appContent.setVisibility(View.GONE);
                rootFrame.addView(fullscreenView, matchFrame());
                rootFrame.setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                );
            }

            @Override
            public void onHideCustomView() {
                hideFullscreenView();
            }
        });
    }

    private void hideFullscreenView() {
        if (fullscreenView == null) return;
        rootFrame.removeView(fullscreenView);
        fullscreenView = null;
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        appContent.setVisibility(View.VISIBLE);
        rootFrame.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        if (fullscreenCallback != null) {
            fullscreenCallback.onCustomViewHidden();
            fullscreenCallback = null;
        }
    }

    private void setChromeVisible(boolean visible) {
        int state = visible ? View.VISIBLE : View.GONE;
        if (headerView != null) headerView.setVisibility(state);
        if (nowRow != null) nowRow.setVisibility(state);
        if (serverScroller != null) serverScroller.setVisibility(state);
        if (tabScroller != null) tabScroller.setVisibility(state);
        if (loadingLabel != null) loadingLabel.setVisibility(visible && isLoadingSchedules ? View.VISIBLE : View.GONE);
        if (scheduleScroll != null) scheduleScroll.setVisibility(state);
        if (footerView != null) footerView.setVisibility(state);
    }

    private void showSponsorDialogIfNeeded() {
        if (sponsorShownThisSession || isFinishing()) return;
        mainHandler.postDelayed(() -> {
            if (!sponsorShownThisSession && !isFinishing()) {
                showSponsorDialog();
            }
        }, 450);
    }

    private void showSponsorDialog() {
        Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setCancelable(false);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(22), dp(22), dp(22), dp(18));
        card.setBackground(stroked(C_SURFACE, Color.argb(70, 212, 175, 55), 1, 22));

        TextView title = new TextView(this);
        title.setText("Sponsor Notice");
        title.setTextColor(C_WHITE);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextSize(20);
        card.addView(title);

        TextView message = new TextView(this);
        message.setText("To continue watching YKN TV, please open our sponsor page once for this app session.");
        message.setTextColor(C_MUTED);
        message.setTextSize(13);
        message.setLineSpacing(dp(2), 1f);
        LinearLayout.LayoutParams messageLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        messageLp.setMargins(0, dp(10), 0, dp(18));
        card.addView(message, messageLp);

        TextView ok = new TextView(this);
        ok.setText("OK");
        ok.setTextColor(C_BLACK);
        ok.setTextSize(13);
        ok.setTypeface(Typeface.DEFAULT_BOLD);
        ok.setGravity(Gravity.CENTER);
        ok.setPadding(0, dp(13), 0, dp(13));
        ok.setBackground(stroked(C_GOLD, C_GOLD, 1, 15));
        ok.setOnClickListener(v -> {
            sponsorShownThisSession = true;
            dialog.dismiss();
            openSponsorPage();
        });
        card.addView(ok, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        dialog.setContentView(card);
        Window window = dialog.getWindow();
        if (window != null) {
            window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            int width = (int) (getResources().getDisplayMetrics().widthPixels * 0.88f);
            window.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT);
        }
        dialog.show();
        Window shownWindow = dialog.getWindow();
        if (shownWindow != null) {
            shownWindow.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            int width = (int) (getResources().getDisplayMetrics().widthPixels * 0.88f);
            shownWindow.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT);
        }
    }

    private void openSponsorPage() {
        String url = Math.random() < PRIMARY_SPONSOR_WEIGHT ? SPONSOR_URLS[0] : SPONSOR_URLS[1];
        openExternalUrl(url);
    }

    private void openExternalUrl(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (ActivityNotFoundException ignored) {
            Toast.makeText(this, "No browser app found.", Toast.LENGTH_SHORT).show();
        }
    }

    private void showSupportDialog() {
        Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setCancelable(true);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(20), dp(20), dp(20), dp(16));
        card.setBackground(stroked(C_SURFACE, Color.argb(70, 212, 175, 55), 1, 24));

        LinearLayout titleRow = new LinearLayout(this);
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);

        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.ic_coffee);
        LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(dp(42), dp(42));
        iconLp.setMargins(0, 0, dp(12), 0);
        titleRow.addView(icon, iconLp);

        LinearLayout titleCol = new LinearLayout(this);
        titleCol.setOrientation(LinearLayout.VERTICAL);

        TextView title = new TextView(this);
        title.setText("Support Developer");
        title.setTextColor(C_WHITE);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextSize(19);
        titleCol.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("Dukung server YKN TV tetap aktif");
        subtitle.setTextColor(C_GOLD);
        subtitle.setTypeface(Typeface.DEFAULT_BOLD);
        subtitle.setTextSize(10);
        subtitle.setSingleLine(true);
        titleCol.addView(subtitle);

        titleRow.addView(titleCol, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        TextView close = new TextView(this);
        close.setText("X");
        close.setTextColor(C_MUTED);
        close.setGravity(Gravity.CENTER);
        close.setTypeface(Typeface.DEFAULT_BOLD);
        close.setTextSize(13);
        close.setPadding(dp(10), dp(6), dp(10), dp(6));
        close.setBackground(stroked(Color.argb(18, 255, 255, 255), Color.argb(26, 255, 255, 255), 1, 10));
        close.setOnClickListener(v -> dialog.dismiss());
        titleRow.addView(close);

        card.addView(titleRow);

        TextView description = new TextView(this);
        description.setText("YKN TV dibuat gratis. Pilih salah satu platform di bawah untuk traktir kopi dan bantu biaya operasional.");
        description.setTextColor(C_MUTED);
        description.setTextSize(12);
        description.setLineSpacing(dp(2), 1f);
        LinearLayout.LayoutParams descLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        descLp.setMargins(0, dp(14), 0, dp(14));
        card.addView(description, descLp);

        card.addView(supportOption(R.drawable.ic_wallet, "Saweria", "QRIS, Gopay, OVO, Dana, LinkAja", Color.rgb(249, 115, 22), SAWERIA_URL, dialog));
        card.addView(supportOption(R.drawable.ic_gift, "BagiBagi", "QRIS, E-Wallet, dan Bank", C_GOLD, BAGIBAGI_URL, dialog));
        card.addView(supportOption(R.drawable.ic_card, "Ko-fi", "Paypal dan Credit Card", Color.rgb(34, 211, 238), KOFI_URL, dialog));

        TextView footer = new TextView(this);
        footer.setText("Developed by YKN Team");
        footer.setTextColor(C_DIM);
        footer.setTypeface(Typeface.DEFAULT_BOLD);
        footer.setTextSize(9);
        footer.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams footerLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        footerLp.setMargins(0, dp(14), 0, 0);
        card.addView(footer, footerLp);

        dialog.setContentView(card);
        dialog.show();
        Window shownWindow = dialog.getWindow();
        if (shownWindow != null) {
            shownWindow.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            int width = (int) (getResources().getDisplayMetrics().widthPixels * 0.9f);
            shownWindow.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT);
        }
    }

    private View supportOption(int iconRes, String title, String subtitle, int color, String url, Dialog dialog) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(12), dp(11), dp(11), dp(11));
        row.setBackground(stroked(withAlpha(color, 18), withAlpha(color, 58), 1, 14));
        row.setOnClickListener(v -> {
            dialog.dismiss();
            openExternalUrl(url);
        });

        FrameLayout badge = new FrameLayout(this);
        badge.setBackground(stroked(withAlpha(color, 35), withAlpha(color, 120), 1, 12));
        LinearLayout.LayoutParams badgeLp = new LinearLayout.LayoutParams(dp(42), dp(42));
        badgeLp.setMargins(0, 0, dp(12), 0);

        ImageView optionIcon = new ImageView(this);
        optionIcon.setImageResource(iconRes);
        optionIcon.setColorFilter(color);
        FrameLayout.LayoutParams optionIconLp = new FrameLayout.LayoutParams(dp(22), dp(22), Gravity.CENTER);
        badge.addView(optionIcon, optionIconLp);
        row.addView(badge, badgeLp);

        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);

        TextView name = new TextView(this);
        name.setText(title);
        name.setTextColor(C_WHITE);
        name.setTypeface(Typeface.DEFAULT_BOLD);
        name.setTextSize(14);
        textCol.addView(name);

        TextView detail = new TextView(this);
        detail.setText(subtitle);
        detail.setTextColor(C_MUTED);
        detail.setTypeface(Typeface.DEFAULT_BOLD);
        detail.setTextSize(9);
        detail.setSingleLine(true);
        detail.setEllipsize(TextUtils.TruncateAt.END);
        textCol.addView(detail);

        row.addView(textCol, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        ImageView arrow = new ImageView(this);
        arrow.setImageResource(R.drawable.ic_arrow_right);
        arrow.setColorFilter(color);
        LinearLayout.LayoutParams arrowLp = new LinearLayout.LayoutParams(dp(21), dp(21));
        arrowLp.setMargins(dp(9), 0, 0, 0);
        row.addView(arrow, arrowLp);

        LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        rowLp.setMargins(0, 0, 0, dp(9));
        row.setLayoutParams(rowLp);
        return row;
    }

    private void startRefreshLoop() {
        if (refreshLoopRunning) return;
        refreshLoopRunning = true;
        mainHandler.postDelayed(refreshRunnable, SCHEDULE_REFRESH_MS);
    }

    private void stopRefreshLoop() {
        refreshLoopRunning = false;
        mainHandler.removeCallbacks(refreshRunnable);
    }

    private void loadSchedules(boolean silent) {
        if (isLoadingSchedules) return;
        if (!hasInternetConnection()) {
            loadingLabel.setVisibility(View.GONE);
            showOfflineNotice(!silent);
            if (mainItems.isEmpty() && channelItems.isEmpty() && esportexItems.isEmpty()) {
                if (loadCachedSchedules()) {
                    if (!silent) {
                        Toast.makeText(this, "Showing saved schedule. Connect internet to play streams.", Toast.LENGTH_LONG).show();
                    }
                    return;
                }
            }
            if (mainItems.isEmpty() && channelItems.isEmpty() && esportexItems.isEmpty()) {
                loadPlaceholder("YKN TV", "No internet connection. Turn on Wi-Fi or mobile data.");
            }
            return;
        }
        isLoadingSchedules = true;
        if (!silent) {
            loadingLabel.setText("MEMUAT JADWAL...");
            loadingLabel.setVisibility(View.VISIBLE);
        }

        scheduleExecutor.execute(() -> {
            FetchResult result = new FetchResult();
            try {
                result.mainItems.addAll(fetchMainSchedule());
            } catch (Exception err) {
                result.error = "Main schedule failed: " + err.getMessage();
            }

            try {
                result.channelItems.addAll(fetchChannelSchedules());
            } catch (Exception err) {
                result.error = appendError(result.error, "TV channels failed: " + err.getMessage());
            }

            try {
                result.esportexItems.addAll(fetchEsportexSchedule());
            } catch (Exception err) {
                result.error = appendError(result.error, "Esportex failed: " + err.getMessage());
            }

            Collections.sort(result.mainItems);
            Collections.sort(result.channelItems);
            Collections.sort(result.esportexItems);

            mainHandler.post(() -> applyScheduleResult(result, silent));
        });
    }

    private void applyScheduleResult(FetchResult result, boolean silent) {
        isLoadingSchedules = false;
        loadingLabel.setVisibility(View.GONE);

        mainItems.clear();
        mainItems.addAll(result.mainItems);
        channelItems.clear();
        channelItems.addAll(result.channelItems);
        esportexItems.clear();
        esportexItems.addAll(result.esportexItems);

        renderTabs();
        reconcileSelection();
        renderServerButtons();
        renderScheduleList();

        if (!silent && result.error != null && getVisibleItems().isEmpty()) {
            Toast.makeText(this, result.error, Toast.LENGTH_LONG).show();
        }

        saveScheduleCache(result);
    }

    private void saveScheduleCache(FetchResult result) {
        if (result == null) return;
        if (result.mainItems.isEmpty() && result.channelItems.isEmpty() && result.esportexItems.isEmpty()) return;

        try {
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .edit()
                    .putString(CACHE_MAIN_ITEMS, scheduleItemsToJson(result.mainItems).toString())
                    .putString(CACHE_CHANNEL_ITEMS, scheduleItemsToJson(result.channelItems).toString())
                    .putString(CACHE_ESPORTEX_ITEMS, scheduleItemsToJson(result.esportexItems).toString())
                    .putLong(CACHE_UPDATED_AT, System.currentTimeMillis())
                    .apply();
        } catch (JSONException ignored) {
        }
    }

    private boolean loadCachedSchedules() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String cachedMain = prefs.getString(CACHE_MAIN_ITEMS, "[]");
        String cachedChannels = prefs.getString(CACHE_CHANNEL_ITEMS, "[]");
        String cachedEsportex = prefs.getString(CACHE_ESPORTEX_ITEMS, "[]");

        try {
            ArrayList<ScheduleItem> cachedMainItems = scheduleItemsFromJson(new JSONArray(cachedMain));
            ArrayList<ScheduleItem> cachedChannelItems = scheduleItemsFromJson(new JSONArray(cachedChannels));
            ArrayList<ScheduleItem> cachedEsportexItems = scheduleItemsFromJson(new JSONArray(cachedEsportex));

            if (cachedMainItems.isEmpty() && cachedChannelItems.isEmpty() && cachedEsportexItems.isEmpty()) {
                return false;
            }

            Collections.sort(cachedMainItems);
            Collections.sort(cachedChannelItems);
            Collections.sort(cachedEsportexItems);

            mainItems.clear();
            mainItems.addAll(cachedMainItems);
            channelItems.clear();
            channelItems.addAll(cachedChannelItems);
            esportexItems.clear();
            esportexItems.addAll(cachedEsportexItems);

            renderTabs();
            reconcileSelection();
            renderServerButtons();
            renderScheduleList();
            return true;
        } catch (JSONException err) {
            return false;
        }
    }

    private JSONArray scheduleItemsToJson(List<ScheduleItem> items) throws JSONException {
        JSONArray array = new JSONArray();
        for (ScheduleItem item : items) {
            array.put(scheduleItemToJson(item));
        }
        return array;
    }

    private JSONObject scheduleItemToJson(ScheduleItem item) throws JSONException {
        JSONObject object = new JSONObject();
        object.put("id", item.id);
        object.put("title", item.title);
        object.put("league", item.league);
        object.put("startRaw", item.startRaw);
        object.put("endRaw", item.endRaw);
        object.put("poster", item.poster);
        object.put("sportKey", item.sportKey);
        object.put("source", item.source);
        object.put("mainSource", item.mainSource);
        object.put("channelSource", item.channelSource);
        object.put("displayTime", item.displayTime);

        JSONArray streams = new JSONArray();
        for (StreamOption stream : item.streams) {
            JSONObject streamObject = new JSONObject();
            streamObject.put("name", stream.name);
            streamObject.put("url", stream.url);
            streamObject.put("type", stream.type);
            streamObject.put("license", stream.license);
            streams.put(streamObject);
        }
        object.put("streams", streams);
        return object;
    }

    private ArrayList<ScheduleItem> scheduleItemsFromJson(JSONArray array) {
        ArrayList<ScheduleItem> items = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) {
            JSONObject object = array.optJSONObject(i);
            ScheduleItem item = scheduleItemFromJson(object);
            if (item != null) items.add(item);
        }
        return items;
    }

    private ScheduleItem scheduleItemFromJson(JSONObject object) {
        if (object == null) return null;

        ScheduleItem item = new ScheduleItem();
        item.id = cleanText(object.optString("id"));
        item.title = cleanText(object.optString("title"));
        item.league = cleanText(object.optString("league"));
        item.startRaw = cleanText(object.optString("startRaw"));
        item.endRaw = cleanText(object.optString("endRaw"));
        item.poster = cleanText(object.optString("poster"));
        item.sportKey = cleanText(object.optString("sportKey"));
        item.source = cleanText(object.optString("source"));
        item.mainSource = object.optBoolean("mainSource");
        item.channelSource = object.optBoolean("channelSource");

        if (item.id.isEmpty() || item.title.isEmpty() || item.sportKey.isEmpty()) return null;

        if (item.channelSource || item.startRaw.isEmpty()) {
            item.startMillis = 0L;
            item.endMillis = Long.MAX_VALUE;
            item.status = "live";
            item.displayTime = firstNonEmpty(object.optString("displayTime"), "24 Jam");
        } else {
            item.startMillis = parseScheduleMillis(item.startRaw);
            item.endMillis = item.endRaw.isEmpty()
                    ? item.startMillis + (item.mainSource ? MAIN_DEFAULT_EVENT_DURATION_MS : ESPORTEX_DEFAULT_EVENT_DURATION_MS)
                    : parseScheduleMillis(item.endRaw);
            item.status = getStatus(item.startMillis, item.endMillis, item.mainSource);
            item.displayTime = formatScheduleTime(item.startMillis);
        }

        JSONArray streams = object.optJSONArray("streams");
        if (streams != null) {
            for (int i = 0; i < streams.length(); i++) {
                JSONObject stream = streams.optJSONObject(i);
                if (stream == null) continue;
                String url = cleanStreamUrl(stream.optString("url"));
                if (url.isEmpty()) continue;
                item.streams.add(new StreamOption(
                        stream.optString("name"),
                        url,
                        stream.optString("type"),
                        stream.optString("license")
                ));
            }
        }

        return item.streams.isEmpty() ? null : item;
    }

    private List<ScheduleItem> fetchMainSchedule() throws Exception {
        JSONArray data = fetchMainEventsArray();
        ArrayList<ScheduleItem> items = new ArrayList<>();

        for (int i = 0; i < data.length(); i++) {
            JSONObject event = data.optJSONObject(i);
            if (event == null) continue;

            String home = cleanText(event.optString("player_1", "TBD"));
            String away = cleanText(event.optString("player_2", "TBD"));
            String title = (!home.isEmpty() && !away.isEmpty())
                    ? home + " vs " + away
                    : cleanText(event.optString("nama_event", "Live Event"));
            String startRaw = cleanText(event.optString("jadwal_event"));
            if (title.isEmpty() || startRaw.isEmpty()) continue;

            String id = cleanText(event.optString("id_event"));
            if (id.isEmpty()) id = "main-" + makeSafeSlug(title + "-" + startRaw);

            ScheduleItem item = new ScheduleItem();
            item.id = id;
            item.title = title;
            item.league = cleanText(event.optString("nama_event", "Live Event"));
            item.startRaw = startRaw;
            item.endRaw = cleanText(event.optString("jadwal_stop"));
            item.poster = firstNonEmpty(event.optString("logo_1"), event.optString("logo_2"));
            item.sportKey = "main";
            item.source = "GitHub";
            item.mainSource = true;
            item.startMillis = parseScheduleMillis(item.startRaw);
            item.endMillis = item.endRaw.isEmpty()
                    ? item.startMillis + MAIN_DEFAULT_EVENT_DURATION_MS
                    : parseScheduleMillis(item.endRaw);
            item.status = getStatus(item.startMillis, item.endMillis, true);
            item.displayTime = formatScheduleTime(item.startMillis);

            String url = cleanStreamUrl(event.optString("url_iptv"));
            String type = cleanText(event.optString("jenis", "hls"));
            String license = cleanText(event.optString("url_license"));
            if (!url.isEmpty()) {
                item.streams.addAll(buildPlayableServers(url, type, license));
            }

            items.add(item);
        }
        return items;
    }

    private JSONArray fetchMainEventsArray() throws Exception {
        String rawUrl = RAW_EVENTS_URL + "?t=" + (System.currentTimeMillis() / MAIN_CACHE_BUST_MS);
        try {
            return new JSONArray(httpGet(rawUrl, 3000));
        } catch (Exception githubErr) {
            return new JSONArray(httpGet(BOT_EVENTS_URL, 4000));
        }
    }

    private List<ScheduleItem> fetchChannelSchedules() throws Exception {
        ArrayList<ScheduleItem> items = new ArrayList<>();
        items.addAll(fetchChannelCategory(
                RAW_TV_SPORTS_URL,
                BOT_TV_SPORTS_URL,
                "tv_sports",
                "GitHub TV Sports",
                "Saluran Sports Premium"
        ));
        items.addAll(fetchChannelCategory(
                RAW_TV_HIBURAN_URL,
                BOT_TV_HIBURAN_URL,
                "tv_hiburan",
                "GitHub TV Hiburan",
                "Saluran Hiburan & Lokal"
        ));
        return items;
    }

    private List<ScheduleItem> fetchChannelCategory(
            String rawUrl,
            String botUrl,
            String tabKey,
            String sourceLabel,
            String fallbackTagline
    ) throws Exception {
        JSONArray data = fetchChannelArray(rawUrl, botUrl);
        ArrayList<ScheduleItem> items = new ArrayList<>();
        HashSet<String> seenIds = new HashSet<>();

        for (int i = 0; i < data.length(); i++) {
            JSONObject channel = data.optJSONObject(i);
            if (channel == null) continue;

            String title = cleanText(channel.optString("nama_channel"));
            String streamUrl = cleanStreamUrl(channel.optString("url_iptv"));
            if (title.isEmpty() || streamUrl.isEmpty()) continue;

            String id = cleanText(channel.optString("id_iptv"));
            if (id.isEmpty()) id = tabKey + "-" + makeSafeSlug(title);
            if (seenIds.contains(id)) id = id + "-" + i;
            seenIds.add(id);

            String type = cleanText(channel.optString("jenis", "hls"));
            String license = cleanText(channel.optString("url_license"));
            ScheduleItem item = new ScheduleItem();
            item.id = id;
            item.title = title;
            item.league = firstNonEmpty(channel.optString("tagline"), fallbackTagline);
            item.startRaw = "";
            item.endRaw = "";
            item.poster = firstNonEmpty(channel.optString("gbr_base64"), channel.optString("logo"));
            item.sportKey = tabKey;
            item.source = sourceLabel;
            item.mainSource = false;
            item.channelSource = true;
            item.startMillis = 0L;
            item.endMillis = Long.MAX_VALUE;
            item.status = "live";
            item.displayTime = "24 Jam";
            item.streams.addAll(buildPlayableServers(streamUrl, type, license));

            if (!item.streams.isEmpty()) items.add(item);
        }

        return items;
    }

    private JSONArray fetchChannelArray(String rawUrl, String botUrl) throws Exception {
        String bustUrl = rawUrl + "?t=" + (System.currentTimeMillis() / MAIN_CACHE_BUST_MS);
        try {
            return new JSONArray(httpGet(bustUrl, 5000));
        } catch (Exception githubErr) {
            return new JSONArray(httpGet(botUrl, 5000));
        }
    }

    private List<StreamOption> buildPlayableServers(String rawUrl, String type, String license) {
        ArrayList<StreamOption> servers = new ArrayList<>();
        String lowerType = type.toLowerCase(Locale.US);
        String lowerUrl = rawUrl.toLowerCase(Locale.US);

        if (lowerType.contains("iframe") || lowerType.contains("xoilac") || lowerUrl.contains("iframe")) {
            servers.add(new StreamOption("Server 1 (Embed)", rawUrl, "iframe", license));
            return servers;
        }

        servers.add(new StreamOption("Server 1 (Direct)", rawUrl, type, license));
        servers.add(new StreamOption("Server 2 (Proxy)", getProxiedUrl(rawUrl), type, license));
        return servers;
    }

    private List<ScheduleItem> fetchEsportexSchedule() throws Exception {
        String url = ESPORTEX_STREAMS_URL + "?cache=" + (System.currentTimeMillis() / ESPORTEX_CACHE_BUST_MS);
        JSONObject root = new JSONObject(httpGet(url, 8000));
        ArrayList<ScheduleItem> items = new ArrayList<>();
        HashSet<String> seenIds = new HashSet<>();

        for (SportTab tab : SPORT_TABS) {
            if ("main".equals(tab.key)) continue;
            JSONArray category = root.optJSONArray(tab.key);
            if (category == null) continue;

            for (int i = 0; i < category.length(); i++) {
                JSONObject event = category.optJSONObject(i);
                if (event == null) continue;

                String title = cleanText(event.optString("tag"));
                String kickoff = cleanText(event.optString("kickoff"));
                if (title.isEmpty() || kickoff.isEmpty()) continue;

                String baseSlug = cleanText(event.optString("slug"));
                if (baseSlug.isEmpty()) baseSlug = makeSafeSlug(title + "-" + kickoff);
                String id = "esportex-" + tab.key + "-" + makeSafeSlug(baseSlug);
                if (seenIds.contains(id)) id = id + "-" + i;
                seenIds.add(id);

                String leagueRaw = cleanText(event.optString("league", tab.label));
                String league = leagueRaw.toLowerCase(Locale.US).contains(tab.label.toLowerCase(Locale.US))
                        ? leagueRaw
                        : tab.label + " - " + leagueRaw;

                ScheduleItem item = new ScheduleItem();
                item.id = id;
                item.title = title;
                item.league = league;
                item.startRaw = kickoff;
                item.endRaw = cleanText(event.optString("endTime"));
                item.poster = cleanText(event.optString("poster"));
                item.sportKey = tab.key;
                item.source = "Esportex";
                item.mainSource = false;
                item.startMillis = parseScheduleMillis(item.startRaw);
                item.endMillis = item.endRaw.isEmpty()
                        ? item.startMillis + ESPORTEX_DEFAULT_EVENT_DURATION_MS
                        : parseScheduleMillis(item.endRaw);
                item.status = getStatus(item.startMillis, item.endMillis, false);
                item.displayTime = formatScheduleTime(item.startMillis);

                JSONArray iframes = event.optJSONArray("iframes");
                if (iframes != null) {
                    for (int s = 0; s < iframes.length(); s++) {
                        JSONObject iframe = iframes.optJSONObject(s);
                        if (iframe == null) continue;
                        String streamUrl = cleanStreamUrl(iframe.optString("url"));
                        if (streamUrl.isEmpty()) continue;
                        String server = cleanText(iframe.optString("server", "Server " + (s + 1)));
                        item.streams.add(new StreamOption(server, streamUrl, "iframe"));
                    }
                }

                items.add(item);
            }
        }
        return items;
    }

    private void renderTabs() {
        tabContainer.removeAllViews();
        for (SportTab tab : SPORT_TABS) {
            int count = countItemsForTab(tab.key);
            int liveCount = countLiveForTab(tab.key);
            TextView chip = new TextView(this);
            chip.setText(formatTabLabel(tab.label, count, liveCount));
            chip.setSingleLine(true);
            chip.setTextSize(11);
            chip.setTypeface(Typeface.DEFAULT_BOLD);
            chip.setGravity(Gravity.CENTER);
            chip.setPadding(dp(15), dp(9), dp(15), dp(9));
            chip.setMinWidth(dp(78));
            boolean selected = activeSport.equals(tab.key);
            chip.setTextColor(selected ? C_BLACK : C_MUTED);
            chip.setBackground(stroked(
                    selected ? C_GOLD : Color.rgb(13, 13, 13),
                    selected ? C_GOLD : Color.argb(28, 255, 255, 255),
                    1,
                    16
            ));
            chip.setOnClickListener(v -> {
                if (activeSport.equals(tab.key)) return;
                activeSport = tab.key;
                renderTabs();
                renderServerButtons();
                renderScheduleList();
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            );
            lp.setMargins(0, 0, dp(8), 0);
            tabContainer.addView(chip, lp);
        }
    }

    private void renderServerButtons() {
        serverContainer.removeAllViews();
        TextView label = smallCaps("SERVER", C_GOLD);
        label.setTextSize(10);
        LinearLayout.LayoutParams labelLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        labelLp.setMargins(0, 0, dp(10), 0);
        serverContainer.addView(label, labelLp);

        if (selectedItem == null || selectedItem.streams.isEmpty()) {
            TextView empty = smallCaps("NO SERVER", C_DIM);
            empty.setBackground(stroked(Color.rgb(12, 12, 12), Color.argb(26, 255, 255, 255), 1, 14));
            serverContainer.addView(empty);
            return;
        }

        for (int i = 0; i < selectedItem.streams.size(); i++) {
            StreamOption option = selectedItem.streams.get(i);
            boolean selected = i == selectedServerIndex;
            TextView button = smallCaps(formatServerLabel(option.name), selected ? C_BLACK : C_MUTED);
            button.setTextSize(10);
            button.setMinWidth(dp(78));
            button.setBackground(stroked(
                    selected ? C_GOLD : Color.rgb(13, 13, 13),
                    selected ? C_GOLD : Color.argb(30, 255, 255, 255),
                    1,
                    14
            ));
            final int serverIndex = i;
            button.setOnClickListener(v -> {
                selectedServerIndex = serverIndex;
                renderServerButtons();
                loadSelectedStream();
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            );
            lp.setMargins(0, 0, dp(8), 0);
            serverContainer.addView(button, lp);
        }
    }

    private void renderScheduleList() {
        scheduleContainer.removeAllViews();
        List<ScheduleItem> visible = getVisibleItems();
        if (visible.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText("Tidak ada jadwal untuk tab ini.");
            empty.setGravity(Gravity.CENTER);
            empty.setTextColor(C_DIM);
            empty.setTypeface(Typeface.DEFAULT_BOLD);
            empty.setTextSize(12);
            empty.setPadding(0, dp(36), 0, dp(36));
            scheduleContainer.addView(empty, new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            ));
            return;
        }

        for (ScheduleItem item : visible) {
            scheduleContainer.addView(buildScheduleCard(item));
        }
    }

    private View buildScheduleCard(ScheduleItem item) {
        boolean selected = selectedItem != null && selectedItem.id.equals(item.id);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(10), dp(10), dp(10), dp(10));
        card.setBackground(stroked(
                selected ? Color.rgb(15, 15, 15) : C_PANEL,
                selected ? Color.argb(180, 212, 175, 55) : Color.argb(20, 255, 255, 255),
                selected ? 2 : 1,
                12
        ));
        card.setElevation(selected ? dp(3) : dp(1));
        card.setOnClickListener(v -> {
            selectedItem = item;
            selectedServerIndex = 0;
            renderServerButtons();
            renderScheduleList();
            loadSelectedStream();
        });

        ImageView poster = new ImageView(this);
        poster.setScaleType(ImageView.ScaleType.CENTER_CROP);
        poster.setBackground(stroked(C_SURFACE_2, Color.argb(24, 255, 255, 255), 1, 10));
        poster.setImageResource(R.drawable.ykn_tv_logo);
        loadImageInto(item.poster, poster);
        LinearLayout.LayoutParams posterLp = new LinearLayout.LayoutParams(dp(80), dp(54));
        posterLp.setMargins(0, 0, dp(11), 0);
        card.addView(poster, posterLp);

        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        textCol.setGravity(Gravity.CENTER_VERTICAL);

        TextView title = new TextView(this);
        title.setText(item.title);
        title.setTextColor(C_WHITE);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextSize(13);
        title.setMaxLines(2);
        title.setEllipsize(TextUtils.TruncateAt.END);
        textCol.addView(title);

        TextView meta = new TextView(this);
        meta.setText(item.league + "  |  " + item.displayTime);
        meta.setTextColor(C_MUTED);
        meta.setTypeface(Typeface.DEFAULT_BOLD);
        meta.setTextSize(10);
        meta.setSingleLine(true);
        meta.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams metaLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        metaLp.setMargins(0, dp(4), 0, 0);
        textCol.addView(meta, metaLp);

        TextView serverCount = new TextView(this);
        serverCount.setText(item.streams.size() + " server");
        serverCount.setTextColor(C_DIM);
        serverCount.setTypeface(Typeface.DEFAULT_BOLD);
        serverCount.setTextSize(9);
        serverCount.setSingleLine(true);
        LinearLayout.LayoutParams serverCountLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        serverCountLp.setMargins(0, dp(3), 0, 0);
        textCol.addView(serverCount, serverCountLp);

        card.addView(textCol, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        TextView status = smallCaps(formatStatusLabel(item.status), getStatusTextColor(item.status));
        status.setBackground(stroked(getStatusBackgroundColor(item.status), getStatusBorderColor(item.status), 1, 999));
        LinearLayout.LayoutParams statusLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        statusLp.setMargins(dp(10), 0, 0, 0);
        card.addView(status, statusLp);

        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        cardLp.setMargins(0, 0, 0, dp(10));
        card.setLayoutParams(cardLp);
        return card;
    }

    private void reconcileSelection() {
        List<ScheduleItem> visible = getVisibleItems();
        if (selectedItem != null) {
            String previousStatus = selectedItem.status;
            ScheduleItem updated = findByIdAnywhere(selectedItem.id);
            if (updated != null) {
                selectedItem = updated;
                if (selectedServerIndex >= selectedItem.streams.size()) selectedServerIndex = 0;
                if (!previousStatus.equals(selectedItem.status)) {
                    if (isFinishedStatus(selectedItem.status)) {
                        loadSelectedStream();
                    } else {
                        updateNowPlayingText(getSelectedStreamOption());
                    }
                }
                if (isCountdownLoaded() && !shouldShowCountdown(selectedItem)) {
                    loadSelectedStream();
                }
                return;
            }
            return;
        }

        if (!visible.isEmpty()) {
            selectedItem = visible.get(0);
            selectedServerIndex = 0;
            loadSelectedStream();
        } else {
            selectedItem = null;
            selectedServerIndex = 0;
            loadPlaceholder("YKN TV", "Waiting for live schedule...");
        }
    }

    private void loadSelectedStream() {
        if (selectedItem == null || selectedItem.streams.isEmpty()) {
            loadPlaceholder(selectedItem == null ? "YKN TV" : selectedItem.title, "No playable server found.");
            return;
        }
        if (!hasInternetConnection()) {
            showOfflineNotice(true);
            loadPlaceholder("YKN TV", "No internet connection. Turn on Wi-Fi or mobile data.");
            return;
        }
        if (selectedServerIndex < 0 || selectedServerIndex >= selectedItem.streams.size()) {
            selectedServerIndex = 0;
        }

        StreamOption option = selectedItem.streams.get(selectedServerIndex);
        String signature = selectedItem.id + "|" + selectedServerIndex + "|" + option.url + "|" + option.type;
        updateNowPlayingText(option);

        if (isFinishedStatus(selectedItem.status)) {
            String finishedSignature = "finished|" + selectedItem.id;
            if (finishedSignature.equals(currentLoadedSignature)) return;
            currentLoadedSignature = finishedSignature;
            loadPlayerBrandFrame("Live ended. This event is no longer available.");
            return;
        }

        if (shouldShowCountdown(selectedItem)) {
            long openAtMillis = getOpenAtMillis(selectedItem);
            String countdownSignature = "countdown|" + selectedItem.id + "|" + openAtMillis;
            if (countdownSignature.equals(currentLoadedSignature)) return;
            currentLoadedSignature = countdownSignature;
            loadCountdownPage(selectedItem, openAtMillis);
            return;
        }

        if (signature.equals(currentLoadedSignature)) return;
        currentLoadedSignature = signature;
        loadPlayerBrandFrame("Opening " + formatServerLabel(option.name) + "...");

        mainHandler.postDelayed(() -> {
            if (!signature.equals(currentLoadedSignature)) return;
            if (isIframeStream(option)) {
                loadIframePage(option.url);
            } else {
                loadVideoPage(option);
            }
        }, PLAYER_LOAD_HOLD_MS);
    }

    private StreamOption getSelectedStreamOption() {
        if (selectedItem == null || selectedItem.streams.isEmpty()) return null;
        if (selectedServerIndex < 0 || selectedServerIndex >= selectedItem.streams.size()) return null;
        return selectedItem.streams.get(selectedServerIndex);
    }

    private void updateNowPlayingText(StreamOption option) {
        if (selectedItem == null) return;
        nowPlayingTitle.setText(selectedItem.title);

        String serverName = option == null ? "" : option.name;
        StringBuilder meta = new StringBuilder();
        meta.append(formatStatusLabel(selectedItem.status))
                .append("  |  ")
                .append(selectedItem.league);
        if (!serverName.isEmpty()) {
            meta.append("  |  ").append(serverName);
        }
        if (!selectedItem.displayTime.isEmpty()) {
            meta.append("  |  ").append(selectedItem.displayTime);
        }
        nowPlayingMeta.setText(meta.toString());
    }

    private void loadIframePage(String url) {
        String safeUrl = TextUtils.htmlEncode(url);
        String brandBackground = buildPlayerBackgroundHtml();
        String html = "<!doctype html><html><head>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover'>"
                + "<style>html,body{margin:0;height:100%;width:100%;overflow:hidden;background:#000;}"
                + ".bg{position:fixed;inset:0;z-index:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 38%,rgba(212,175,55,.18),transparent 34%),linear-gradient(180deg,#080808,#000);transition:opacity .22s ease;}"
                + ".bg:after{content:'YKN TV';position:absolute;bottom:11px;left:0;right:0;text-align:center;color:rgba(212,175,55,.42);font:900 9px Arial,sans-serif;letter-spacing:0}.bg img{width:62%;max-width:310px;max-height:66%;object-fit:contain;filter:drop-shadow(0 12px 32px rgba(212,175,55,.28));opacity:.92}.wordmark{font:900 34px Arial,sans-serif;color:#fff;text-shadow:0 10px 28px #000}.wordmark span{color:#D4AF37}.ready .bg{opacity:0}"
                + "iframe{position:fixed;inset:0;z-index:1;width:100%;height:100%;border:0;background:transparent;opacity:0;transition:opacity .22s ease}.ready iframe{opacity:1}.error-state iframe{opacity:0;}"
                + ".status{position:fixed;top:8px;left:8px;z-index:3;max-width:210px;height:30px;display:flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.2);border-radius:8px;background:rgba(0,0,0,.72);color:#f8fafc;font:900 10px Arial,sans-serif;padding:0 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;}"
                + ".status.loading:before{content:'';width:7px;height:7px;border-radius:50%;background:#D4AF37;box-shadow:0 0 14px rgba(212,175,55,.85);animation:pulse 1s infinite}.status.success{color:#86efac;border-color:rgba(134,239,172,.42);background:rgba(2,44,34,.78)}.status.error{color:#fca5a5;border-color:rgba(248,113,113,.55);background:rgba(69,10,10,.78)}@keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}"
                + "[hidden]{display:none!important;}</style>"
                + "</head><body>"
                + "<div class='bg'>" + brandBackground + "</div>"
                + "<iframe id='f' src='" + safeUrl + "' "
                + "allow='autoplay; fullscreen; encrypted-media' allowfullscreen referrerpolicy='no-referrer'></iframe>"
                + "<div id='status' class='status loading'>LOADING IFRAME</div>"
                + "<script>window.open=function(){return null};"
                + "var f=document.getElementById('f'),status=document.getElementById('status'),iframeDone=false;"
                + "function setStatus(t,state,hide){var s=state||'loading';status.textContent=t;status.hidden=!t;status.className='status '+s;document.body.classList.toggle('ready',s==='success');document.body.classList.toggle('error-state',s==='error');if(s==='success'||s==='error')iframeDone=true;if(hide)setTimeout(function(){status.hidden=true},hide);}"
                + "window.__yknPlayerStatus=function(t,state){setStatus(t,state||'loading',0)};window.__yknPlayerError=function(t){setStatus('ERROR: '+String(t||'IFRAME FAILED').toUpperCase(),'error',0)};"
                + "f.addEventListener('load',function(){setStatus('SUCCESS','success',0)});f.addEventListener('error',function(){setStatus('ERROR: IFRAME FAILED','error')});setTimeout(function(){if(!iframeDone)setStatus('SUCCESS','success',0)},3200);"
                + "try{Object.defineProperty(window,'opener',{value:null,writable:false});}catch(e){}"
                + "document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');"
                + "if(a&&a.href&&a.href.indexOf('ykn.local')<0){e.preventDefault();e.stopPropagation();}},true);</script>"
                + "</body></html>";
        playerView.loadDataWithBaseURL(LOCAL_PLAYER_BASE, html, "text/html", "UTF-8", null);
    }

    private void loadCountdownPage(ScheduleItem item, long openAtMillis) {
        nowPlayingTitle.setText(item.title);
        nowPlayingMeta.setText(item.league + "  |  Opens 30 minutes before kick-off");

        String title = TextUtils.htmlEncode(item.title);
        String league = TextUtils.htmlEncode(item.league);
        String kickoff = TextUtils.htmlEncode(formatScheduleDateTime(item.startMillis));
        String openAt = TextUtils.htmlEncode(formatScheduleDateTime(openAtMillis));

        String html = "<!doctype html><html><head>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover'>"
                + "<style>html,body{margin:0;height:100%;width:100%;overflow:hidden;background:#020202;color:#fff;font-family:Arial,sans-serif;}"
                + "*{box-sizing:border-box;}body{display:flex;align-items:center;justify-content:center;text-align:center;background:linear-gradient(180deg,#070707,#000);}"
                + ".box{width:100%;height:100%;padding:9px 12px 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;}"
                + ".eyebrow{display:inline-flex;align-items:center;max-width:100%;gap:6px;padding:5px 9px;border-radius:999px;background:rgba(212,175,55,.13);color:#D4AF37;font:900 9px Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;}"
                + ".dot{flex:0 0 6px;width:6px;height:6px;border-radius:50%;background:#D4AF37;box-shadow:0 0 12px #D4AF37;}"
                + "h1{margin:0;max-width:100%;font-size:15px;line-height:1.16;font-weight:900;letter-spacing:0;text-transform:uppercase;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}"
                + ".league{max-width:100%;color:#a1a1aa;font-size:9px;line-height:1.2;font-weight:800;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}"
                + ".timer{width:100%;max-width:420px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:1px auto 0;}"
                + ".unit{min-width:0;padding:6px 2px 5px;border-radius:10px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);}"
                + ".num{display:block;color:#D4AF37;font-size:24px;font-weight:900;line-height:1;}"
                + ".lab{display:block;margin-top:3px;color:#71717a;font-size:7px;line-height:1;font-weight:900;text-transform:uppercase;}"
                + ".meta{width:100%;display:flex;align-items:center;justify-content:center;gap:4px 10px;flex-wrap:wrap;color:#d4d4d8;font-size:9px;font-weight:800;line-height:1.2;}"
                + ".meta span{color:#D4AF37;white-space:nowrap;}@media(max-height:190px){.box{gap:4px;padding:7px 10px}.league{display:none}.eyebrow{font-size:8px;padding:4px 8px}h1{font-size:13px;-webkit-line-clamp:1}.num{font-size:21px}.unit{padding:5px 2px 4px}.meta{font-size:8px}}}</style>"
                + "</head><body><div class='box'>"
                + "<div class='eyebrow'><span class='dot'></span>Stream opens in</div>"
                + "<h1>" + title + "</h1><div class='league'>" + league + "</div>"
                + "<div class='timer'><div class='unit'><span class='num' id='d'>00</span><span class='lab'>Days</span></div>"
                + "<div class='unit'><span class='num' id='h'>00</span><span class='lab'>Hours</span></div>"
                + "<div class='unit'><span class='num' id='m'>00</span><span class='lab'>Mins</span></div>"
                + "<div class='unit'><span class='num' id='s'>00</span><span class='lab'>Secs</span></div></div>"
                + "<div class='meta'><div>Kick-off <span>" + kickoff + "</span></div><div>Opens <span>" + openAt + "</span></div></div>"
                + "</div><script>window.open=function(){return null};var target=" + openAtMillis + ";"
                + "function pad(n){return String(Math.max(0,n)).padStart(2,'0')}"
                + "function tick(){var diff=target-Date.now();if(diff<=0){try{if(window.YknNative)window.YknNative.reloadSelectedStream();}catch(e){}return;}"
                + "var sec=Math.floor(diff/1000),d=Math.floor(sec/86400);sec-=d*86400;var h=Math.floor(sec/3600);sec-=h*3600;var m=Math.floor(sec/60);var s=sec-m*60;"
                + "document.getElementById('d').textContent=pad(d);document.getElementById('h').textContent=pad(h);document.getElementById('m').textContent=pad(m);document.getElementById('s').textContent=pad(s);}"
                + "tick();setInterval(tick,1000);</script></body></html>";
        playerView.loadDataWithBaseURL(LOCAL_PLAYER_BASE, html, "text/html", "UTF-8", null);
    }

    private void loadVideoPage(StreamOption option) {
        String safeUrl = escapeJsString(option.url);
        String safeType = escapeJsString(option.type);
        String safeLicense = escapeJsString(option.license);
        String brandBackground = buildPlayerBackgroundHtml();
        String html = "<!doctype html><html><head>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover'>"
                + "<script src='https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js'></script>"
                + "<script src='https://cdn.jsdelivr.net/npm/shaka-player@4/dist/shaka-player.compiled.min.js'></script>"
                + "<style>html,body{margin:0;height:100%;width:100%;overflow:hidden;background:#000;color:#fff;font-family:Arial,sans-serif;}"
                + "*{box-sizing:border-box}.player{position:fixed;inset:0;background:#000;overflow:hidden;touch-action:manipulation;}"
                + ".bg{position:absolute;inset:0;z-index:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 38%,rgba(212,175,55,.18),transparent 34%),linear-gradient(180deg,#080808,#000);transition:opacity .22s ease;}"
                + ".bg:after{content:'YKN TV';position:absolute;bottom:11px;left:0;right:0;text-align:center;color:rgba(212,175,55,.42);font:900 9px Arial,sans-serif;letter-spacing:0}.bg img{width:62%;max-width:310px;max-height:66%;object-fit:contain;filter:drop-shadow(0 12px 32px rgba(212,175,55,.28));opacity:.92}.wordmark{font:900 34px Arial,sans-serif;color:#fff;text-shadow:0 10px 28px #000}.wordmark span{color:#D4AF37}.player.ready .bg{opacity:0}.player.error-state .bg{opacity:1}"
                + "video{position:absolute;inset:0;z-index:1;width:100%;height:100%;background:transparent;object-fit:contain;opacity:0;transition:opacity .22s ease}.player.ready video{opacity:1}.player.error-state video{opacity:0;}"
                + ".shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.55),transparent 32%,rgba(0,0,0,.78));}"
                + ".top{position:absolute;left:9px;right:9px;top:8px;display:flex;align-items:center;justify-content:flex-start;gap:8px;z-index:3;}"
                + ".brand{margin-left:auto;font-size:12px;font-weight:900;text-shadow:0 2px 8px #000}.brand span{color:#D4AF37}.status{max-width:58vw;height:28px;display:flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:rgba(0,0,0,.68);color:#f8fafc;font-size:10px;font-weight:900;padding:0 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;}"
                + ".status.loading:before{content:'';width:7px;height:7px;border-radius:50%;background:#D4AF37;box-shadow:0 0 14px rgba(212,175,55,.85);animation:pulse 1s infinite}.status.success{color:#86efac;border-color:rgba(134,239,172,.42);background:rgba(2,44,34,.78)}.status.error{color:#fca5a5;border-color:rgba(248,113,113,.55);background:rgba(69,10,10,.78)}@keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}"
                + ".center{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;z-index:2}.big{width:62px;height:62px;border:1px solid rgba(255,255,255,.28);border-radius:50%;background:rgba(0,0,0,.48);color:#fff;box-shadow:0 12px 42px rgba(0,0,0,.55);backdrop-filter:blur(12px);pointer-events:auto;}"
                + ".loader{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#f8fafc;font-size:10px;font-weight:900;text-transform:uppercase;text-shadow:0 2px 8px #000;opacity:0;pointer-events:none;transition:opacity .18s ease}.player.loading-state .loader{opacity:1}.player.ready .loader,.player.error-state .loader{opacity:0}.ring{width:38px;height:38px;border-radius:50%;border:3px solid rgba(255,255,255,.18);border-top-color:#D4AF37;box-shadow:0 0 22px rgba(212,175,55,.28);animation:spin .85s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}"
                + ".controls{position:absolute;left:0;right:0;bottom:0;z-index:4;padding:26px 10px 9px;background:linear-gradient(180deg,transparent,rgba(0,0,0,.9));display:flex;flex-direction:column;gap:8px;transition:opacity .2s ease;}"
                + ".player.idle .controls,.player.idle .top,.player.idle .shade{opacity:0;pointer-events:none}.seekrow{display:flex;align-items:center;gap:8px}.time{min-width:76px;text-align:right;color:#d4d4d8;font-size:10px;font-weight:800}"
                + "input[type=range]{accent-color:#D4AF37}#seek{flex:1;min-width:0;height:18px}.bar{display:flex;align-items:center;justify-content:space-between;gap:7px}.group{display:flex;align-items:center;gap:6px;min-width:0}.rightTools{position:relative;flex:0 0 auto}.rightTools>select{display:none!important}"
                + "button.icon{width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:50%;background:transparent;color:#fff;padding:0;outline:0}button.big{width:62px;height:62px}button.icon:active,button.icon.active{background:rgba(255,255,255,.18);transform:scale(.96)}button.icon svg,.big svg{width:21px;height:21px;display:block;fill:currentColor}.big svg{width:28px;height:28px}"
                + ".vol{width:68px}.live{color:#ef4444;font-size:10px;font-weight:900}.error{color:#fca5a5}.settingsMenu{position:absolute;right:0;bottom:42px;width:238px;max-width:calc(100vw - 18px);max-height:calc(100vh - 54px);overflow-y:auto;overscroll-behavior:contain;padding:9px;border:1px solid rgba(255,255,255,.16);border-radius:8px;background:rgba(8,8,8,.92);box-shadow:0 18px 44px rgba(0,0,0,.55);backdrop-filter:blur(16px);display:flex;flex-direction:column;gap:8px;transform-origin:right bottom}.settingsMenu::-webkit-scrollbar{display:none}.settingsHead{display:flex;align-items:center;justify-content:space-between;color:#fff;font-size:10px;font-weight:900;text-transform:uppercase}.settingsHead span{color:#D4AF37}.settingBlock{border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.055);padding:8px}.settingLabel{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#f8fafc;font-size:10px;font-weight:900;text-transform:uppercase}.settingLabel b{color:#D4AF37;font-size:10px;white-space:nowrap}.choices{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.choice{height:28px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(0,0,0,.42);color:#f8fafc;font-size:10px;font-weight:900;padding:0 10px;outline:0}.choice.active{background:#D4AF37;color:#020202;border-color:#D4AF37}.choice:active{transform:scale(.97)}[hidden]{display:none!important;}"
                + "@media(max-width:390px){.brand{font-size:10px}.status{max-width:62vw;font-size:9px}.vol{display:none}button.icon{width:31px;height:31px}button.big{width:58px;height:58px}.settingsMenu{right:0;bottom:39px;width:226px;max-width:calc(100vw - 16px);padding:8px}.choice{height:27px;font-size:9px;padding:0 9px}.time{min-width:58px}.controls{padding-left:8px;padding-right:8px}}"
                + "@media(max-height:270px){.settingsMenu{bottom:38px;width:224px;max-height:calc(100vh - 48px);padding:6px;gap:5px}.settingsHead{display:none}.settingBlock{padding:6px}.settingLabel{font-size:9px}.settingLabel b{font-size:9px}.choices{gap:5px;margin-top:5px}.choice{height:24px;font-size:9px;padding:0 8px}}"
                + "@media(max-height:190px){.top{display:none}.controls{gap:5px;padding-bottom:6px}.center .big{width:48px;height:48px}.big svg{width:24px;height:24px}}"
                + "</style>"
                + "</head><body><div id='p' class='player loading-state'><div class='bg'>" + brandBackground + "</div><video id='v' autoplay playsinline webkit-playsinline preload='auto'></video>"
                + "<div class='shade'></div><div class='loader'><div class='ring'></div><div id='loaderText'>LOADING STREAM</div></div><div class='top'><div id='status' class='status loading'>LOADING STREAM</div><div class='brand'>YKN <span>TV</span></div></div>"
                + "<div class='center'><button id='big' class='big icon' aria-label='Play'></button></div>"
                + "<div class='controls'><div class='seekrow'><input id='seek' type='range' min='0' max='1000' value='0'><div id='time' class='time'>LIVE</div></div>"
                + "<div class='bar'><div class='group'><button id='play' class='icon' aria-label='Play'></button><button id='mute' class='icon' aria-label='Mute'></button><input id='vol' class='vol' type='range' min='0' max='100' value='100'></div>"
                + "<div class='group rightTools'><select id='quality' hidden disabled></select><select id='speed' hidden></select><select id='fit' hidden></select><button id='settings' class='icon' aria-label='Player settings' aria-expanded='false'></button><div id='settingsMenu' class='settingsMenu' hidden><div class='settingsHead'>Player <span>Settings</span></div><div id='qualityRow' class='settingBlock'><div class='settingLabel'><span>Quality</span><b id='qualityValue'>AUTO</b></div><div id='qualityChoices' class='choices'></div></div><div class='settingBlock'><div class='settingLabel'><span>Ratio</span><b id='fitValue'>DEFAULT</b></div><div id='fitChoices' class='choices'></div></div><div class='settingBlock'><div class='settingLabel'><span>Speed</span><b id='speedValue'>1x</b></div><div id='speedChoices' class='choices'></div></div></div><button id='fs' class='icon' aria-label='Fullscreen'></button></div></div></div></div>"
                + "<script>window.open=function(){return null};"
                + "var src='" + safeUrl + "',streamType='" + safeType + "',rawLicense='" + safeLicense + "',p=document.getElementById('p'),v=document.getElementById('v'),hls=null,dash=null;"
                + "var playBtn=document.getElementById('play'),big=document.getElementById('big'),mute=document.getElementById('mute'),vol=document.getElementById('vol'),seek=document.getElementById('seek'),time=document.getElementById('time'),quality=document.getElementById('quality'),speed=document.getElementById('speed'),fit=document.getElementById('fit'),settings=document.getElementById('settings'),settingsMenu=document.getElementById('settingsMenu'),qualityRow=document.getElementById('qualityRow'),qualityChoices=document.getElementById('qualityChoices'),speedChoices=document.getElementById('speedChoices'),fitChoices=document.getElementById('fitChoices'),qualityValue=document.getElementById('qualityValue'),speedValue=document.getElementById('speedValue'),fitValue=document.getElementById('fitValue'),fs=document.getElementById('fs'),status=document.getElementById('status'),loaderText=document.getElementById('loaderText'),seeking=false,idleTimer=0,statusTimer=0,readyWatch=0,streamReady=false,lastVolume=1,qualityAvailable=false;"
                + "var ICON={play:`<svg viewBox='0 0 24 24'><path d='M8 5v14l11-7z'/></svg>`,pause:`<svg viewBox='0 0 24 24'><path d='M7 5h4v14H7zM13 5h4v14h-4z'/></svg>`,vol:`<svg viewBox='0 0 24 24'><path d='M3 9v6h4l5 4V5L7 9H3z'/><path d='M16.5 12c0-1.77-1-3.29-2.5-4.03v8.05c1.5-.73 2.5-2.25 2.5-4.02z'/><path d='M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z'/></svg>`,mute:`<svg viewBox='0 0 24 24'><path d='M3 9v6h4l5 4V5L7 9H3z'/><path d='M16.59 12l2.71-2.71-1.41-1.41-2.72 2.71-2.71-2.71-1.41 1.41L13.76 12l-2.71 2.71 1.41 1.41 2.71-2.71 2.72 2.71 1.41-1.41z'/></svg>`,settings:`<svg viewBox='0 0 24 24'><path d='M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65-2-3.46-2.49 1a7.34 7.34 0 0 0-1.69-.98L15 3.28h-4l-.36 2.65c-.6.24-1.17.57-1.69.98l-2.49-1-2 3.46 2.11 1.65c-.04.32-.07.65-.07.98s.02.66.07.98l-2.11 1.65 2 3.46 2.49-1c.52.4 1.08.73 1.69.98L11 20.72h4l.36-2.65c.6-.24 1.17-.57 1.69-.98l2.49 1 2-3.46-2.11-1.65zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z'/></svg>`,full:`<svg viewBox='0 0 24 24'><path d='M5 5h6v2H7v4H5V5zm8 0h6v6h-2V7h-4V5zM5 13h2v4h4v2H5v-6zm12 0h2v6h-6v-2h4v-4z'/></svg>`,exitFull:`<svg viewBox='0 0 24 24'><path d='M7 7h4v2H9v2H7V7zm8 0h2v4h-2V9h-2V7h2zM7 13h2v2h2v2H7v-4zm8 2v-2h2v4h-4v-2h2z'/></svg>`};"
                + "fs.innerHTML=ICON.full;settings.innerHTML=ICON.settings;"
                + "function setStatus(t,state,hide){clearTimeout(statusTimer);var s=state||'loading';status.textContent=t||'';if(loaderText)loaderText.textContent=t||'LOADING STREAM';status.hidden=!t;status.className='status '+s;p.classList.toggle('loading-state',s==='loading');p.classList.toggle('ready',s==='success');p.classList.toggle('error-state',s==='error');if(t)p.classList.remove('idle');if(hide&&t)statusTimer=setTimeout(function(){status.hidden=true},hide)}"
                + "function setLoading(t){if(streamReady)return;setStatus(t||'LOADING STREAM','loading',0)}"
                + "function setSuccess(t,hide){streamReady=true;if(readyWatch)clearInterval(readyWatch);setStatus(t||'SUCCESS','success',hide||0)}"
                + "function setError(t){if(readyWatch)clearInterval(readyWatch);setStatus('ERROR: '+String(t||'STREAM FAILED').toUpperCase(),'error',0)}"
                + "function errText(d){var r=d&&d.response,c=r&&(r.code||r.status);if(c)return 'HTTP '+c;if(d&&d.details)return String(d.details).replace(/_/g,' ');if(v.error&&v.error.code){var map={1:'ABORTED',2:'NETWORK',3:'DECODE',4:'SOURCE NOT SUPPORTED'};return 'MEDIA '+v.error.code+' '+(map[v.error.code]||'ERROR')}return 'STREAM FAILED'}"
                + "function checkReady(){if(streamReady)return;if(v.readyState>=2||v.videoWidth>0||v.currentTime>0||(!v.paused&&!v.ended))setSuccess('SUCCESS')}"
                + "function watchReady(){if(readyWatch)clearInterval(readyWatch);readyWatch=setInterval(checkReady,500);setTimeout(checkReady,900);setTimeout(checkReady,1800);setTimeout(checkReady,3200)}"
                + "function bump(){p.classList.remove('idle');clearTimeout(idleTimer);if(settingsMenu&&!settingsMenu.hidden)return;if(!v.paused)idleTimer=setTimeout(function(){p.classList.add('idle')},3000)}"
                + "['mousemove','touchstart','click'].forEach(function(e){p.addEventListener(e,bump,{passive:true})});"
                + "window.__yknPlayerStatus=function(t,state){setStatus(t,state||'loading',0)};window.__yknPlayerError=function(t){setError(t)};"
                + "function isDashSource(){var t=(streamType||'').toLowerCase(),u=(src||'').toLowerCase();return t.indexOf('dash')>=0||u.indexOf('.mpd')>=0}"
                + "function isClearKeySource(){return (streamType||'').toLowerCase().indexOf('clearkey')>=0}"
                + "function parseClearKeyPair(s){s=String(s||'').trim();var m=s.match(/^([0-9a-fA-F]{32}):([0-9a-fA-F]{32})$/);return m?{keyId:m[1].toLowerCase(),key:m[2].toLowerCase()}:null}"
                + "function xorDecryptBase64(data,key){var raw=atob(data),out='';for(var i=0;i<raw.length;i++)out+=String.fromCharCode(raw.charCodeAt(i)^key.charCodeAt(i%key.length));return out}"
                + "function decodeClearKey(){var direct=parseClearKeyPair(rawLicense);if(direct)return direct;var keys=['Nhsdfugu8','indonesia','1785088500'];for(var i=0;i<keys.length;i++){try{var pair=parseClearKeyPair(xorDecryptBase64(rawLicense,keys[i]));if(pair)return pair}catch(e){}}return null}"
                + "function shakaErr(e){if(!e)return 'DASH FAILED';var code=e.code||e.errorCode||'';var cat=e.category||'';var msg=e.message||e.data&&e.data.join&&e.data.join(' ')||'';return ('DASH '+code+' '+msg).trim()||'DASH FAILED'}"
                + "function setupDash(){if(!window.shaka||!shaka.Player){setError('DASH ENGINE FAILED');return}try{shaka.polyfill.installAll()}catch(e){}if(!shaka.Player.isBrowserSupported()){setError('DASH NOT SUPPORTED');return}setLoading(isClearKeySource()?'LOADING DASH DRM':'LOADING DASH');dash=new shaka.Player(v);dash.addEventListener('error',function(ev){setError(shakaErr(ev.detail))});dash.addEventListener('buffering',function(ev){if(ev.buffering&&!streamReady)setLoading('LOADING DASH')});if(isClearKeySource()){var clear=decodeClearKey();if(!clear){setError('DASH KEY DECODE FAILED');return}var map={};map[clear.keyId]=clear.key;dash.configure({drm:{clearKeys:map}})}dash.load(src).then(function(){populateQuality();setLoading('LOADING STREAM');watchReady();doPlay();updateTime()}).catch(function(e){setError(shakaErr(e))})}"
                + "function fmt(s){if(!isFinite(s)||s<0)return '0:00';var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),x=Math.floor(s%60);return (h?h+':':'')+String(m).padStart(h?2:1,'0')+':'+String(x).padStart(2,'0')}"
                + "function finite(){return isFinite(v.duration)&&v.duration>0}"
                + "function isNativeFs(){try{return !!(window.YknNative&&window.YknNative.isFullscreen&&window.YknNative.isFullscreen())}catch(e){return false}}"
                + "function isFs(){return !!(document.fullscreenElement||document.webkitFullscreenElement||document.mozFullScreenElement||document.msFullscreenElement||isNativeFs())}"
                + "function updateFullscreenButton(){var on=isFs();fs.innerHTML=on?ICON.exitFull:ICON.full;fs.setAttribute('aria-label',on?'Exit fullscreen':'Fullscreen')}"
                + "function updateButtons(){var paused=v.paused;playBtn.innerHTML=paused?ICON.play:ICON.pause;big.innerHTML=paused?ICON.play:ICON.pause;playBtn.setAttribute('aria-label',paused?'Play':'Pause');big.setAttribute('aria-label',paused?'Play':'Pause');big.style.display=paused?'grid':'none';if(v.volume>0&&!v.muted)lastVolume=v.volume;if(document.activeElement!==vol)vol.value=String(Math.round(v.volume*100));var muted=v.muted||v.volume===0;mute.innerHTML=muted?ICON.mute:ICON.vol;mute.setAttribute('aria-label',muted?'Unmute':'Mute');updateFullscreenButton()}"
                + "function updateTime(){if(finite()){if(!seeking)seek.value=String(Math.round((v.currentTime/v.duration)*1000));time.textContent=fmt(v.currentTime)+' / '+fmt(v.duration);seek.disabled=false}else{seek.value='1000';time.innerHTML='<span class=\"live\">LIVE</span>';seek.disabled=true}}"
                + "function doPlay(){watchReady();try{var pr=v.play();if(pr&&pr.catch)pr.catch(function(){setLoading('TAP PLAY TO START')})}catch(e){setError('PLAY FAILED')}}"
                + "function nativePlay(){v.src=src;watchReady();doPlay()}"
                + "function togglePlay(){if(v.paused)doPlay();else v.pause();bump();updateButtons()}"
                + "function optionLabel(sel,fallback){return sel.options[sel.selectedIndex]?sel.options[sel.selectedIndex].textContent:fallback}"
                + "function renderChoices(sel,box,valueBox,handler,fallback){if(!box)return;box.innerHTML='';for(var i=0;i<sel.options.length;i++){var opt=sel.options[i],btn=document.createElement('button');btn.type='button';btn.className='choice'+(opt.value===sel.value?' active':'');btn.textContent=opt.textContent;btn.dataset.value=opt.value;btn.onclick=function(){sel.value=this.dataset.value;handler();renderSettings()};box.appendChild(btn)}if(valueBox)valueBox.textContent=optionLabel(sel,fallback)}"
                + "function renderSettings(){if(qualityRow)qualityRow.hidden=!qualityAvailable||quality.options.length<2;renderChoices(quality,qualityChoices,qualityValue,applyQuality,'AUTO');renderChoices(fit,fitChoices,fitValue,applyFit,'DEFAULT');renderChoices(speed,speedChoices,speedValue,applySpeed,'1x')}"
                + "function closeSettings(){settingsMenu.hidden=true;settings.classList.remove('active');settings.setAttribute('aria-expanded','false');bump()}"
                + "settings.onclick=function(e){e.stopPropagation();var open=settingsMenu.hidden;settingsMenu.hidden=!open;settings.classList.toggle('active',open);settings.setAttribute('aria-expanded',open?'true':'false');bump()};settingsMenu.addEventListener('click',function(e){e.stopPropagation()});p.addEventListener('click',function(e){if(!settingsMenu.hidden&&!settingsMenu.contains(e.target)&&!settings.contains(e.target))closeSettings()});"
                + "function setupSpeed(){[0.5,0.75,1,1.25,1.5,2].forEach(function(r){var o=document.createElement('option');o.value=String(r);o.textContent=r===1?'1x':r+'x';if(r===1)o.selected=true;speed.appendChild(o)});renderSettings()}"
                + "function setFitMode(mode,announce){v.style.objectFit=mode||'contain';v.style.objectPosition='center center';if(announce){var label=optionLabel(fit,'DEFAULT');setStatus('SCREEN '+label,'success',1600)}}"
                + "function setupFit(){[{v:'contain',t:'DEFAULT'},{v:'cover',t:'FULL'},{v:'fill',t:'STRETCH'}].forEach(function(x){var o=document.createElement('option');o.value=x.v;o.textContent=x.t;fit.appendChild(o)});fit.value='contain';setFitMode('contain',false);renderSettings()}"
                + "function applyQuality(){var val=quality.value;if(hls)hls.currentLevel=Number(val);else if(dash){if(val==='-1'){dash.configure({abr:{enabled:true}})}else{var id=Number(String(val).replace('dash:',''));var track=dash.getVariantTracks().filter(function(t){return t.id===id})[0];if(track){dash.configure({abr:{enabled:false}});dash.selectVariantTrack(track,true)}}}setStatus(val==='-1'?'AUTO QUALITY':'QUALITY '+optionLabel(quality,'AUTO'),'success',1600);bump()}"
                + "function applySpeed(){var r=Number(speed.value)||1;try{v.playbackRate=r;v.defaultPlaybackRate=r;setStatus('SPEED '+optionLabel(speed,'1x'),'success',1600)}catch(e){setError('SPEED UNAVAILABLE')}bump()}"
                + "function applyFit(){setFitMode(fit.value,true);bump()}"
                + "function populateQuality(){quality.innerHTML='<option value=\"-1\">AUTO</option>';var added=0;if(hls&&hls.levels&&hls.levels.length){var byHeight={};hls.levels.forEach(function(l,i){var h=l.height||0;if(!h)return;var b=l.bitrate||l.bandwidth||0;if(!byHeight[h]||b>byHeight[h].bitrate)byHeight[h]={value:String(i),bitrate:b}});Object.keys(byHeight).map(Number).sort(function(a,b){return b-a}).forEach(function(h){var o=document.createElement('option');o.value=byHeight[h].value;o.textContent=h+'p'+(h===1080?' HD':'');quality.appendChild(o);added++})}else if(dash){var byDashHeight={};dash.getVariantTracks().forEach(function(t){var h=t.height||0;if(!h)return;var b=t.bandwidth||0;if(!byDashHeight[h]||b>byDashHeight[h].bandwidth)byDashHeight[h]={value:'dash:'+t.id,bandwidth:b}});Object.keys(byDashHeight).map(Number).sort(function(a,b){return b-a}).forEach(function(h){var o=document.createElement('option');o.value=byDashHeight[h].value;o.textContent=h+'p'+(h===1080?' HD':'');quality.appendChild(o);added++})}qualityAvailable=added>0;quality.hidden=true;quality.disabled=added===0;renderSettings()}"
                + "playBtn.onclick=togglePlay;big.onclick=togglePlay;mute.onclick=function(){var muted=v.muted||v.volume===0;if(muted){if(v.volume===0)v.volume=lastVolume||1;v.muted=false}else{if(v.volume>0)lastVolume=v.volume;v.muted=true}updateButtons();bump()};vol.oninput=function(){var next=Number(vol.value)/100;v.volume=next;if(next>0){lastVolume=next;v.muted=false}else{v.muted=true}updateButtons();bump()};"
                + "seek.oninput=function(){seeking=true;bump()};seek.onchange=function(){if(finite())v.currentTime=(Number(seek.value)/1000)*v.duration;seeking=false;bump()};"
                + "quality.onchange=function(){applyQuality();renderSettings()};"
                + "speed.onchange=function(){applySpeed();renderSettings()};"
                + "fit.onchange=function(){applyFit();renderSettings()};"
                + "async function exitFs(){try{if(document.exitFullscreen){await document.exitFullscreen();setTimeout(updateFullscreenButton,120);return true}if(document.webkitExitFullscreen){document.webkitExitFullscreen();setTimeout(updateFullscreenButton,120);return true}if(document.mozCancelFullScreen){document.mozCancelFullScreen();setTimeout(updateFullscreenButton,120);return true}if(document.msExitFullscreen){document.msExitFullscreen();setTimeout(updateFullscreenButton,120);return true}if(v.webkitExitFullscreen){v.webkitExitFullscreen();setTimeout(updateFullscreenButton,120);return true}}catch(e){}try{if(window.YknNative&&window.YknNative.exitFullscreen){window.YknNative.exitFullscreen();setTimeout(updateFullscreenButton,180);return true}}catch(e){}return false}"
                + "fs.onclick=async function(){closeSettings();bump();if(isFs()){if(!(await exitFs()))setError('EXIT FULLSCREEN FAILED');return}try{var el=p;if(el.requestFullscreen){await el.requestFullscreen()}else if(el.webkitRequestFullscreen){el.webkitRequestFullscreen()}else if(v.webkitEnterFullscreen){v.webkitEnterFullscreen()}else{setError('FULLSCREEN UNAVAILABLE');return}setTimeout(updateFullscreenButton,180)}catch(e){try{if(window.YknNative&&window.YknNative.exitFullscreen&&isNativeFs()){window.YknNative.exitFullscreen();return}}catch(x){}setError('FULLSCREEN UNAVAILABLE')}};"
                + "['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'].forEach(function(e){document.addEventListener(e,updateFullscreenButton)});"
                + "v.addEventListener('loadstart',function(){setLoading('LOADING STREAM')});v.addEventListener('loadedmetadata',function(){setSuccess('SUCCESS')});v.addEventListener('loadeddata',function(){setSuccess('SUCCESS')});v.addEventListener('canplay',function(){setSuccess('SUCCESS')});v.addEventListener('play',function(){setSuccess('SUCCESS');updateButtons();bump()});v.addEventListener('pause',updateButtons);v.addEventListener('timeupdate',function(){updateTime();checkReady()});v.addEventListener('progress',checkReady);v.addEventListener('durationchange',updateTime);v.addEventListener('volumechange',updateButtons);v.addEventListener('playing',function(){setSuccess('SUCCESS');bump()});v.addEventListener('waiting',function(){setLoading('LOADING STREAM')});v.addEventListener('stalled',function(){setLoading('LOADING STREAM')});v.addEventListener('error',function(){setError(errText(null))});"
                + "setupSpeed();setupFit();updateButtons();updateTime();updateFullscreenButton();"
                + "if(isDashSource()){setupDash()}"
                + "else if(window.Hls&&Hls.isSupported()){setLoading('LOADING HLS');hls=new Hls({enableWorker:true,lowLatencyMode:true,capLevelToPlayerSize:false});hls.loadSource(src);hls.attachMedia(v);hls.on(Hls.Events.MANIFEST_PARSED,function(){populateQuality();setLoading('LOADING STREAM');watchReady();doPlay();updateTime()});hls.on(Hls.Events.ERROR,function(e,d){if(d&&d.fatal){setError(errText(d))}else if(!streamReady&&d&&d.response){setError(errText(d))}})}"
                + "else if(v.canPlayType('application/vnd.apple.mpegurl')){nativePlay();}"
                + "else{nativePlay();}"
                + "</script>"
                + "</body></html>";
        playerView.loadDataWithBaseURL(LOCAL_PLAYER_BASE, html, "text/html", "UTF-8", null);
    }

    private void loadPlaceholder(String title, String message) {
        currentLoadedSignature = "";
        nowPlayingTitle.setText(title);
        nowPlayingMeta.setText(message);
        loadPlayerBrandFrame(message);
    }

    private void loadPlayerBrandFrame(String message) {
        String safeMessage = TextUtils.htmlEncode(message);
        String html = "<!doctype html><html><head>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover'>"
                + "<style>html,body{margin:0;height:100%;width:100%;overflow:hidden;background:#000;color:#fff;font-family:Arial,sans-serif;}"
                + "body{display:grid;place-items:center;background:linear-gradient(180deg,#050505,#000);}"
                + ".wrap{text-align:center;padding:14px;max-width:92%;}"
                + ".logo{font-size:32px;line-height:1;font-weight:900;letter-spacing:0}.logo span{color:#D4AF37}"
                + ".badge{display:inline-flex;margin-top:8px;padding:4px 8px;border-radius:8px;background:#D4AF37;color:#020202;font-size:9px;font-weight:900;text-transform:uppercase;}"
                + "p{margin:9px auto 0;max-width:320px;color:#a1a1aa;font-size:10px;line-height:1.3;font-weight:800;text-transform:uppercase;}</style></head>"
                + "<body><div class='wrap'><div class='logo'>YKN <span>TV</span></div><div class='badge'>LIVE HUB</div><p>"
                + safeMessage
                + "</p></div></body></html>";
        playerView.loadDataWithBaseURL(LOCAL_PLAYER_BASE, html, "text/html", "UTF-8", null);
    }

    private List<ScheduleItem> getVisibleItems() {
        if ("main".equals(activeSport)) return new ArrayList<>(mainItems);
        if ("tv_sports".equals(activeSport) || "tv_hiburan".equals(activeSport)) {
            ArrayList<ScheduleItem> visibleChannels = new ArrayList<>();
            for (ScheduleItem item : channelItems) {
                if (activeSport.equals(item.sportKey)) visibleChannels.add(item);
            }
            return visibleChannels;
        }
        ArrayList<ScheduleItem> visible = new ArrayList<>();
        for (ScheduleItem item : esportexItems) {
            if (activeSport.equals(item.sportKey)) visible.add(item);
        }
        return visible;
    }

    private ScheduleItem findById(List<ScheduleItem> items, String id) {
        for (ScheduleItem item : items) {
            if (item.id.equals(id)) return item;
        }
        return null;
    }

    private ScheduleItem findByIdAnywhere(String id) {
        ScheduleItem item = findById(mainItems, id);
        if (item != null) return item;
        item = findById(channelItems, id);
        if (item != null) return item;
        return findById(esportexItems, id);
    }

    private int countItemsForTab(String key) {
        if ("main".equals(key)) return mainItems.size();
        if ("tv_sports".equals(key) || "tv_hiburan".equals(key)) {
            int count = 0;
            for (ScheduleItem item : channelItems) if (key.equals(item.sportKey)) count++;
            return count;
        }
        int count = 0;
        for (ScheduleItem item : esportexItems) if (key.equals(item.sportKey)) count++;
        return count;
    }

    private int countLiveForTab(String key) {
        int count = 0;
        List<ScheduleItem> items;
        if ("main".equals(key)) {
            items = mainItems;
        } else if ("tv_sports".equals(key) || "tv_hiburan".equals(key)) {
            items = channelItems;
        } else {
            items = esportexItems;
        }
        for (ScheduleItem item : items) {
            if (key.equals(item.sportKey) && "live".equals(item.status)) count++;
        }
        return count;
    }

    private boolean isIframeStream(StreamOption option) {
        String type = option.type.toLowerCase(Locale.US);
        String url = option.url.toLowerCase(Locale.US);
        return type.contains("iframe")
                || type.contains("xoilac")
                || url.contains("streams.esportex.site/player")
                || url.contains("iframe");
    }

    private boolean hasInternetConnection() {
        ConnectivityManager connectivityManager =
                (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null) return false;
        NetworkInfo activeNetwork = connectivityManager.getActiveNetworkInfo();
        return activeNetwork != null && activeNetwork.isConnected();
    }

    private void showOfflineNotice(boolean force) {
        long now = System.currentTimeMillis();
        if (!force && now - lastOfflineToastAt < OFFLINE_TOAST_INTERVAL_MS) return;
        lastOfflineToastAt = now;
        Toast.makeText(
                this,
                "No internet connection. Please turn on Wi-Fi or mobile data.",
                Toast.LENGTH_LONG
        ).show();
    }

    private String httpGet(String url, int timeoutMs) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(timeoutMs);
        connection.setReadTimeout(timeoutMs);
        connection.setUseCaches(false);
        connection.setRequestProperty("Accept", "application/json,text/plain,*/*");
        connection.setRequestProperty("Cache-Control", "no-store");
        connection.setRequestProperty("User-Agent", "YKN-TV-Android/1.0");

        int status = connection.getResponseCode();
        InputStream input = status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream();

        if (input == null) throw new IllegalStateException("HTTP " + status);

        try (BufferedInputStream buffered = new BufferedInputStream(input)) {
            byte[] buffer = new byte[8192];
            StringBuilder builder = new StringBuilder();
            int read;
            while ((read = buffered.read(buffer)) != -1) {
                builder.append(new String(buffer, 0, read));
            }
            if (status < 200 || status >= 300) {
                throw new IllegalStateException("HTTP " + status + ": " + builder);
            }
            return builder.toString();
        } finally {
            connection.disconnect();
        }
    }

    private void loadImageInto(String url, ImageView imageView) {
        String cleanUrl = cleanText(url);
        imageView.setTag(cleanUrl);
        if (cleanUrl.isEmpty()) return;

        if (cleanUrl.startsWith("data:image")) {
            int commaIndex = cleanUrl.indexOf(',');
            if (commaIndex > 0) {
                try {
                    byte[] bytes = Base64.decode(cleanUrl.substring(commaIndex + 1), Base64.DEFAULT);
                    Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    if (bitmap != null) imageView.setImageBitmap(bitmap);
                } catch (IllegalArgumentException ignored) {
                }
            }
            return;
        }

        Bitmap cached = imageCache.get(cleanUrl);
        if (cached != null) {
            imageView.setImageBitmap(cached);
            return;
        }

        imageExecutor.execute(() -> {
            Bitmap bitmap = null;
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(cleanUrl).openConnection();
                connection.setConnectTimeout(4000);
                connection.setReadTimeout(4000);
                connection.setRequestProperty("User-Agent", "YKN-TV-Android/1.0");
                try (InputStream input = connection.getInputStream()) {
                    bitmap = BitmapFactory.decodeStream(input);
                }
                if (bitmap != null) imageCache.put(cleanUrl, bitmap);
            } catch (Exception ignored) {
                bitmap = null;
            } finally {
                if (connection != null) connection.disconnect();
            }

            Bitmap finalBitmap = bitmap;
            if (finalBitmap != null) {
                mainHandler.post(() -> {
                    Object tag = imageView.getTag();
                    if (tag != null && cleanUrl.equals(tag.toString())) {
                        imageView.setImageBitmap(finalBitmap);
                    }
                });
            }
        });
    }

    private long parseScheduleMillis(String raw) {
        String value = normalizeScheduleInput(raw);
        if (value.isEmpty()) return 0L;

        String[] patterns = {
                "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
                "yyyy-MM-dd'T'HH:mm:ssXXX",
                "yyyy-MM-dd'T'HH:mmXXX"
        };

        for (String pattern : patterns) {
            SimpleDateFormat formatter = new SimpleDateFormat(pattern, Locale.US);
            formatter.setLenient(false);
            try {
                Date date = formatter.parse(value);
                if (date != null) return date.getTime();
            } catch (ParseException ignored) {
            }
        }

        return 0L;
    }

    private String normalizeScheduleInput(String raw) {
        String value = cleanText(raw);
        if (value.isEmpty()) return "";
        value = value.replaceFirst("\\s+(Z|[+-]\\d{2}:?\\d{0,2})$", "$1");
        value = value.replaceFirst("\\s+", "T");

        if (value.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
            return value + "T00:00:00+07:00";
        }

        if (value.matches(".*T.*[+-]\\d{4}$")) {
            value = value.replaceFirst("([+-]\\d{2})(\\d{2})$", "$1:$2");
        }

        if (value.matches(".*T.*[+-]\\d{2}$")) {
            value = value.replaceFirst("([+-]\\d{2})$", "$1:00");
        }

        boolean hasTimeZone = value.matches(".*(?:Z|[+-]\\d{2}:\\d{2})$");
        return hasTimeZone ? value : value + "+07:00";
    }

    private String formatScheduleTime(long millis) {
        if (millis <= 0L) return "";
        Date date = new Date(millis);
        Date now = new Date();
        SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm", indonesianLocale);
        timeFormat.setTimeZone(userDisplayTimeZone);

        if (isSameUserDisplayDay(date, now)) {
            return timeFormat.format(date) + " " + getUserTimeZoneLabel();
        }

        SimpleDateFormat dateFormat = new SimpleDateFormat("d MMM - HH:mm", indonesianLocale);
        dateFormat.setTimeZone(userDisplayTimeZone);
        return dateFormat.format(date) + " " + getUserTimeZoneLabel();
    }

    private String formatScheduleDateTime(long millis) {
        if (millis <= 0L) return "";
        SimpleDateFormat dateFormat = new SimpleDateFormat("EEE, d MMM yyyy HH:mm", indonesianLocale);
        dateFormat.setTimeZone(userDisplayTimeZone);
        return dateFormat.format(new Date(millis)) + " " + getUserTimeZoneLabel();
    }

    private boolean isSameUserDisplayDay(Date a, Date b) {
        Calendar ca = Calendar.getInstance(userDisplayTimeZone);
        Calendar cb = Calendar.getInstance(userDisplayTimeZone);
        ca.setTime(a);
        cb.setTime(b);
        return ca.get(Calendar.YEAR) == cb.get(Calendar.YEAR)
                && ca.get(Calendar.DAY_OF_YEAR) == cb.get(Calendar.DAY_OF_YEAR);
    }

    private String getUserTimeZoneLabel() {
        String id = userDisplayTimeZone.getID();
        if ("Asia/Makassar".equals(id) || "Asia/Ujung_Pandang".equals(id)) return "WITA";
        if ("Asia/Jayapura".equals(id)) return "WIT";
        return "WIB";
    }

    private static TimeZone resolveUserIndonesianTimeZone() {
        TimeZone deviceZone = TimeZone.getDefault();
        String id = deviceZone.getID();
        if ("Asia/Makassar".equals(id) || "Asia/Ujung_Pandang".equals(id)) {
            return TimeZone.getTimeZone("Asia/Makassar");
        }
        if ("Asia/Jayapura".equals(id)) {
            return TimeZone.getTimeZone("Asia/Jayapura");
        }
        if ("Asia/Jakarta".equals(id) || "Asia/Pontianak".equals(id)) {
            return TimeZone.getTimeZone("Asia/Jakarta");
        }

        int offsetHours = deviceZone.getOffset(System.currentTimeMillis()) / (60 * 60 * 1000);
        if (offsetHours == 8) return TimeZone.getTimeZone("Asia/Makassar");
        if (offsetHours == 9) return TimeZone.getTimeZone("Asia/Jayapura");
        return TimeZone.getTimeZone("Asia/Jakarta");
    }

    private String getStatus(long startMillis, long endMillis, boolean mainSource) {
        long now = System.currentTimeMillis();
        if (startMillis <= 0L) return "upcoming";
        long liveStart = startMillis - MAIN_LIVE_GRACE_MS;
        long liveEnd = endMillis > 0L
                ? endMillis + MAIN_LIVE_GRACE_MS
                : startMillis + (mainSource ? MAIN_DEFAULT_EVENT_DURATION_MS : ESPORTEX_DEFAULT_EVENT_DURATION_MS);

        if (now > liveEnd) return "finished";
        if (endMillis > 0L && now >= endMillis) return "ending";
        if (now >= liveStart) return "live";
        return "upcoming";
    }

    private long getOpenAtMillis(ScheduleItem item) {
        if (item == null || item.startMillis <= 0L) return 0L;
        return item.startMillis - MAIN_LIVE_GRACE_MS;
    }

    private boolean shouldShowCountdown(ScheduleItem item) {
        if (item == null || item.channelSource || item.startMillis <= 0L) return false;
        return System.currentTimeMillis() < getOpenAtMillis(item);
    }

    private boolean isCountdownLoaded() {
        return currentLoadedSignature != null && currentLoadedSignature.startsWith("countdown|");
    }

    private boolean isFinishedStatus(String status) {
        return "finished".equals(status) || "ended".equals(status);
    }

    private String cleanStreamUrl(String url) {
        String clean = cleanText(url);
        int pipe = clean.indexOf('|');
        if (pipe >= 0) clean = clean.substring(0, pipe).trim();
        return clean;
    }

    private String getProxiedUrl(String url) {
        String clean = cleanStreamUrl(url);
        String encodedPath = clean.replaceFirst("^(https?)://", "$1/");
        return PROXY_BASE_URL + "/" + encodedPath;
    }

    private String cleanText(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }

    private String escapeJsString(String value) {
        return cleanText(value)
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\n", "")
                .replace("\r", "");
    }

    private String getPlayerLogoDataUri() {
        if (!TextUtils.isEmpty(playerLogoDataUri)) return playerLogoDataUri;
        try (InputStream input = getResources().openRawResource(R.drawable.ykn_tv_logo);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            playerLogoDataUri = "data:image/png;base64,"
                    + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
        } catch (Exception ignored) {
            playerLogoDataUri = "";
        }
        return playerLogoDataUri;
    }

    private String buildPlayerBackgroundHtml() {
        String logoDataUri = getPlayerLogoDataUri();
        if (TextUtils.isEmpty(logoDataUri)) {
            return "<div class='wordmark'>YKN <span>TV</span></div>";
        }
        return "<img src='" + TextUtils.htmlEncode(logoDataUri) + "' alt='YKN TV'>";
    }

    private String firstNonEmpty(String first, String second) {
        String cleanFirst = cleanText(first);
        return cleanFirst.isEmpty() ? cleanText(second) : cleanFirst;
    }

    private String makeSafeSlug(String value) {
        String normalized = Normalizer.normalize(cleanText(value), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return normalized.toLowerCase(Locale.US)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
    }

    private String appendError(String existing, String next) {
        if (existing == null || existing.isEmpty()) return next;
        return existing + " | " + next;
    }

    private String formatTabLabel(String label, int count, int liveCount) {
        return label;
    }

    private String formatServerLabel(String name) {
        String clean = cleanText(name);
        String lower = clean.toLowerCase(Locale.US);
        if (lower.contains("direct")) return "DIRECT";
        if (lower.contains("proxy")) return "PROXY";
        if (lower.contains("embed")) return "EMBED";
        if (lower.contains("auto")) return "AUTO";
        return clean
                .replace("(Direct)", "")
                .replace("(Proxy)", "")
                .replace("/iOS", "")
                .replace("/IOS", "")
                .trim()
                .toUpperCase(Locale.US);
    }

    private String formatStatusLabel(String status) {
        if ("finished".equals(status) || "ended".equals(status)) return "ENDED";
        if ("ending".equals(status)) return "LIVE ENDED";
        if ("live".equals(status)) return "LIVE";
        return "UPCOMING";
    }

    private TextView smallCaps(String text, int textColor) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextColor(textColor);
        tv.setTextSize(9);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setGravity(Gravity.CENTER);
        tv.setSingleLine(true);
        tv.setPadding(dp(10), dp(6), dp(10), dp(6));
        return tv;
    }

    private int getStatusBackgroundColor(String status) {
        if ("live".equals(status)) return Color.argb(28, 229, 9, 20);
        if ("ending".equals(status)) return Color.argb(28, 212, 175, 55);
        if ("upcoming".equals(status)) return Color.argb(28, 212, 175, 55);
        return Color.argb(20, 161, 161, 170);
    }

    private int getStatusBorderColor(String status) {
        if ("live".equals(status)) return Color.argb(90, 229, 9, 20);
        if ("ending".equals(status)) return Color.argb(110, 212, 175, 55);
        if ("upcoming".equals(status)) return Color.argb(90, 212, 175, 55);
        return Color.argb(55, 161, 161, 170);
    }

    private int getStatusTextColor(String status) {
        if ("live".equals(status)) return Color.rgb(248, 113, 113);
        if ("ending".equals(status)) return C_GOLD;
        if ("upcoming".equals(status)) return C_GOLD;
        return C_MUTED;
    }

    private int withAlpha(int color, int alpha) {
        return Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color));
    }

    private GradientDrawable stroked(int fill, int stroke, int strokeDp, float radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(radiusDp));
        drawable.setStroke(dp(strokeDp), stroke);
        return drawable;
    }

    private GradientDrawable playerChrome() {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(Color.BLACK);
        drawable.setCornerRadius(dp(14));
        drawable.setStroke(dp(1), Color.argb(26, 255, 255, 255));
        return drawable;
    }

    private FrameLayout.LayoutParams matchFrame() {
        return new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        );
    }

    private LinearLayout.LayoutParams normalPlayerLayoutParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                getPlayerHeight()
        );
        params.setMargins(dp(8), dp(4), dp(8), dp(7));
        return params;
    }

    private int getPlayerHeight() {
        float density = getResources().getDisplayMetrics().density;
        int screenWidthDp = (int) (getResources().getDisplayMetrics().widthPixels / density);
        int playerWidthDp = Math.max(280, screenWidthDp - 16);
        int playerDp = Math.max(176, Math.min(320, Math.round(playerWidthDp * 9f / 16f)));
        return dp(playerDp);
    }

    private int dp(float value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private boolean isBlockedAdUrl(String url) {
        if (url == null) return false;
        String lower = url.toLowerCase(Locale.US);
        Uri uri = Uri.parse(lower);
        String host = uri.getHost();
        String haystack = host == null ? lower : host;
        for (String keyword : AD_HOST_KEYWORDS) {
            if (haystack.contains(keyword)) return true;
        }
        return lower.contains("popunder") || lower.contains("vignette") || lower.contains("smartlink");
    }

    private boolean isAllowedMainFrameUrl(String url) {
        if (url == null) return true;
        String lower = url.toLowerCase(Locale.US);
        return lower.startsWith("about:")
                || lower.startsWith("data:")
                || lower.startsWith("blob:")
                || lower.startsWith(LOCAL_PLAYER_BASE);
    }

    private boolean isTrustedPlayerNavigation(String url) {
        if (isAllowedMainFrameUrl(url)) return true;
        String host = Uri.parse(url == null ? "" : url).getHost();
        if (host == null) return false;
        String lowerHost = host.toLowerCase(Locale.US);
        if (lowerHost.endsWith("esportex.site")) return true;

        if (selectedItem != null && selectedServerIndex >= 0 && selectedServerIndex < selectedItem.streams.size()) {
            String selectedHost = Uri.parse(selectedItem.streams.get(selectedServerIndex).url).getHost();
            return selectedHost != null && lowerHost.equals(selectedHost.toLowerCase(Locale.US));
        }
        return false;
    }

    private final class NativeBridge {
        @JavascriptInterface
        public void exitFullscreen() {
            mainHandler.post(MainActivity.this::hideFullscreenView);
        }

        @JavascriptInterface
        public boolean isFullscreen() {
            return fullscreenView != null;
        }

        @JavascriptInterface
        public void reloadSelectedStream() {
            mainHandler.post(() -> {
                currentLoadedSignature = "";
                loadSelectedStream();
                renderScheduleList();
                renderTabs();
            });
        }
    }

    private void notifyPlayerError(WebView view, String message) {
        if (view == null) return;
        String safeMessage = escapeJsString(firstNonEmpty(message, "Stream failed"));
        view.evaluateJavascript(
                "try{if(window.__yknPlayerError)window.__yknPlayerError('" + safeMessage + "');}catch(e){}",
                null
        );
    }

    private final class GuardedPlayerClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request.getUrl() == null ? "" : request.getUrl().toString();
            if (isBlockedAdUrl(url)) return true;
            if (!request.isForMainFrame() && request.hasGesture() && !isTrustedPlayerNavigation(url)) {
                Toast.makeText(MainActivity.this, "Blocked iframe redirect.", Toast.LENGTH_SHORT).show();
                return true;
            }
            if (request.isForMainFrame() && !isAllowedMainFrameUrl(url)) {
                Toast.makeText(MainActivity.this, "Blocked iframe redirect.", Toast.LENGTH_SHORT).show();
                return true;
            }
            return false;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            if (isBlockedAdUrl(url)) return true;
            if (!isAllowedMainFrameUrl(url)) {
                Toast.makeText(MainActivity.this, "Blocked iframe redirect.", Toast.LENGTH_SHORT).show();
                return true;
            }
            return false;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            String url = request.getUrl() == null ? "" : request.getUrl().toString();
            if (isBlockedAdUrl(url)) {
                return new WebResourceResponse(
                        "text/plain",
                        "UTF-8",
                        new ByteArrayInputStream(new byte[0])
                );
            }
            return super.shouldInterceptRequest(view, request);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            super.onReceivedError(view, request, error);
            if (request == null || !request.isForMainFrame()) return;

            String message = "Stream load error";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && error != null) {
                message = "Stream error " + error.getErrorCode() + ": " + error.getDescription();
            }
            notifyPlayerError(view, message);
            Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show();
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            super.onReceivedHttpError(view, request, errorResponse);
            if (request == null || errorResponse == null) return;
            if (!request.isForMainFrame() && !isTrustedPlayerNavigation(request.getUrl().toString())) return;

            int status = errorResponse.getStatusCode();
            if (status >= 400) {
                notifyPlayerError(view, "HTTP " + status);
                Toast.makeText(MainActivity.this, "Stream HTTP " + status, Toast.LENGTH_SHORT).show();
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            view.evaluateJavascript(
                    "window.open=function(){return null};"
                            + "document.addEventListener('click',function(e){"
                            + "var a=e.target.closest&&e.target.closest('a');"
                            + "if(a&&a.href&&a.href.indexOf('ykn.local')<0){e.preventDefault();e.stopPropagation();}"
                            + "},true);",
                    null
            );
        }
    }

    private static final class SportTab {
        final String key;
        final String label;

        SportTab(String key, String label) {
            this.key = key;
            this.label = label;
        }
    }

    private static final class StreamOption {
        final String name;
        final String url;
        final String type;
        final String license;

        StreamOption(String name, String url, String type) {
            this(name, url, type, "");
        }

        StreamOption(String name, String url, String type, String license) {
            this.name = name == null || name.trim().isEmpty() ? "Server" : name.trim();
            this.url = url == null ? "" : url.trim();
            this.type = type == null || type.trim().isEmpty() ? "hls" : type.trim();
            this.license = license == null ? "" : license.trim();
        }
    }

    private static final class ScheduleItem implements Comparable<ScheduleItem> {
        String id;
        String title;
        String league;
        String startRaw;
        String endRaw;
        String poster;
        String sportKey;
        String source;
        String status;
        String displayTime;
        boolean mainSource;
        boolean channelSource;
        long startMillis;
        long endMillis;
        final ArrayList<StreamOption> streams = new ArrayList<>();

        @Override
        public int compareTo(ScheduleItem other) {
            int statusCompare = statusRank(status) - statusRank(other.status);
            if (statusCompare != 0) return statusCompare;
            if (startMillis != other.startMillis) return Long.compare(startMillis, other.startMillis);
            return title.compareToIgnoreCase(other.title);
        }

        private int statusRank(String status) {
            if ("live".equals(status)) return 0;
            if ("ending".equals(status)) return 1;
            if ("upcoming".equals(status)) return 2;
            if ("finished".equals(status) || "ended".equals(status)) return 3;
            return 3;
        }
    }

    private static final class FetchResult {
        final ArrayList<ScheduleItem> mainItems = new ArrayList<>();
        final ArrayList<ScheduleItem> channelItems = new ArrayList<>();
        final ArrayList<ScheduleItem> esportexItems = new ArrayList<>();
        String error;
    }
}
