package com.cookingtimerpro

import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.*
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

private const val PRODUCT_ID = "cooking_timer_premium"

class BillingModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), PurchasesUpdatedListener {

    override fun getName() = "BillingModule"

    private var billingClient: BillingClient? = null
    private var productDetails: ProductDetails? = null

    // ── Helpers ──────────────────────────────────────────────────────────────

    private fun emit(event: String, params: WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, params)
    }

    // Required by React Native for modules that emit events
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    // ── Connection ───────────────────────────────────────────────────────────

    @ReactMethod
    fun connect() {
        if (billingClient?.isReady == true) {
            queryProductDetails()
            checkExistingPurchases()
            return
        }
        billingClient = BillingClient.newBuilder(reactContext)
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
            )
            .build()

        billingClient!!.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    queryProductDetails()
                    checkExistingPurchases()
                }
            }
            override fun onBillingServiceDisconnected() {}
        })
    }

    // ── Product details (loads real price from Play Store) ───────────────────

    private fun queryProductDetails() {
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                listOf(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(PRODUCT_ID)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                )
            )
            .build()

        billingClient?.queryProductDetailsAsync(params) { result, details ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK && details.isNotEmpty()) {
                productDetails = details[0]
                val map = Arguments.createMap()
                map.putString("price", details[0].oneTimePurchaseOfferDetails?.formattedPrice ?: "$2.99")
                emit("billing:productLoaded", map)
            }
        }
    }

    // ── Check / restore existing purchases ───────────────────────────────────

    @ReactMethod
    fun restorePurchases() {
        checkExistingPurchases()
    }

    private fun checkExistingPurchases() {
        billingClient?.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        ) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                val owned = purchases.any {
                    it.products.contains(PRODUCT_ID) &&
                    it.purchaseState == Purchase.PurchaseState.PURCHASED
                }
                val map = Arguments.createMap()
                map.putBoolean("restored", true)
                map.putBoolean("owned", owned)
                emit("billing:restored", map)
            }
        }
    }

    // ── Launch purchase flow ─────────────────────────────────────────────────

    @ReactMethod
    fun purchasePremium() {
        val activity = reactContext.currentActivity ?: run {
            emitError("No activity available — try again")
            return
        }
        val details = productDetails ?: run {
            // Not loaded yet — reconnect and ask JS to retry
            connect()
            emitError("Product not loaded yet — please try again in a moment")
            return
        }

        val flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(
                listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(details)
                        .build()
                )
            )
            .build()

        // Must be called on the main thread
        Handler(Looper.getMainLooper()).post {
            billingClient?.launchBillingFlow(activity, flowParams)
        }
    }

    // ── Purchase result callback ─────────────────────────────────────────────

    override fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                purchases?.forEach { purchase ->
                    if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED &&
                        purchase.products.contains(PRODUCT_ID)
                    ) {
                        acknowledgePurchase(purchase)
                    }
                }
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                emit("billing:cancelled", null)
            }
            else -> emitError(result.debugMessage)
        }
    }

    private fun acknowledgePurchase(purchase: Purchase) {
        if (purchase.isAcknowledged) {
            // Already acknowledged — just fire success
            emit("billing:success", Arguments.createMap())
            return
        }
        val params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.purchaseToken)
            .build()
        billingClient?.acknowledgePurchase(params) { result ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                emit("billing:success", Arguments.createMap())
            } else {
                emitError(result.debugMessage)
            }
        }
    }

    private fun emitError(message: String) {
        val map = Arguments.createMap()
        map.putString("message", message)
        emit("billing:error", map)
    }
}
