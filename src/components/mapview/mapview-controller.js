import { Controller } from "stimulus"
import { setOptions, importLibrary } from "@googlemaps/js-api-loader"
import { MarkerClusterer, SuperClusterAlgorithm } from "@googlemaps/markerclusterer"

import { getLocale, getURLParams, lang, trigger } from "../../js/utils"
import photoManager from "../../js/photo-manager"
import { appState } from "../../js/app"

const MAX_INDIVIDUAL_MARKERS = 999

export default class extends Controller {
  static get targets() {
    return ["map"]
  }

  connect() {
    this.markers = []
    this.groupMarkers = []
    this.markerTemplate = document.getElementById("mapmarker-template").content.firstElementChild
    this.boundLoad = this.load.bind(this)
    this.boundOnClusterClick = this.onClusterClick.bind(this)
    this.boundRenderClusterMarker = this.renderClusterMarker.bind(this)
  }

  async show() {
    this.element.classList.add("is-visible")
    await this.initMap()
  }

  async initMap() {
    if (this.map) return

    const key = this.element.dataset.googleMapsKey
    if (!key) {
      trigger("snackbar:show", { message: "Google Maps is not configured.", status: "error", autoHide: false })
      return
    }

    trigger("loader:show", { id: "loaderBase" })
    setOptions({ key, version: "weekly", language: getLocale() })

    const [maps, marker] = await Promise.all([importLibrary("maps"), importLibrary("marker")])
    this.maps = maps
    this.marker = marker

    const params = getURLParams()
    this.map = new maps.Map(this.mapTarget, {
      center: {
        lat: Number(params.gc && params.gc.split(",")[0]) || 47.4979,
        lng: Number(params.gc && params.gc.split(",")[1]) || 19.0402,
      },
      zoom: Number(params.gz) || 12,
      mapId: this.element.dataset.googleMapsId || undefined,
      colorScheme: appState("theme--light") ? "LIGHT" : "DARK",
    })

    this.clusterer = new MarkerClusterer({
      map: this.map,
      algorithm: new SuperClusterAlgorithm({ radius: 320, maxZoom: 22 }),
      renderer: { render: this.boundRenderClusterMarker },
    })
    this.clusterer.defaultOnClusterClick = this.clusterer.onClusterClick
    this.clusterer.onClusterClick = null
    this.map.addListener("idle", () => {
      clearTimeout(this.loadTimer)
      this.loadTimer = setTimeout(this.boundLoad, 200)
    })
    trigger("loader:hide", { id: "loaderBase" })

    // show the url's search filters in the search field
    setTimeout(() => trigger("search:syncWithURL"), 20)
  }

  async load() {
    if (!this.map) return
    if (this.loading) {
      this.loadPending = true
      return
    }

    this.loading = true
    trigger("loader:show", { id: "loaderBase" })
    trigger("snackbar:hide")

    try {
      do {
        this.loadPending = false
        const bounds = this.map.getBounds()
        if (!bounds) return

        const params = getURLParams()
        const northEast = bounds.getNorthEast()
        const southWest = bounds.getSouthWest()
        params.gb = `${northEast.lat().toFixed(4)},${southWest.lng().toFixed(4)},${southWest.lat().toFixed(4)},${northEast.lng().toFixed(4)}`
        params.gz = Math.round(this.map.getZoom()).toString()
        params.size = 0
        params.clustered = true
        params.disableAggregatedYears = true

        let data = await photoManager.loadPhotoData(params, true)
        if (data.total <= MAX_INDIVIDUAL_MARKERS) {
          params.size = MAX_INDIVIDUAL_MARKERS
          params.clustered = false
          data = await photoManager.loadPhotoData(params, true)
        }

        this.updateHistory(params)
        this.renderMarkers(data)

        if (data.total === 0) {
          trigger("snackbar:show", { message: lang("map").no_results, status: "error", autoHide: false })
        }
      } while (this.loadPending)
    } finally {
      this.loading = false
      trigger("loader:hide", { id: "loaderBase" })
      if (this.loadPending) this.load()
    }
  }

  renderMarkers(data) {
    this.clusterer.clearMarkers()
    this.markers.forEach(marker => {
      marker.map = null
    })
    this.groupMarkers.forEach(marker => {
      marker.map = null
    })
    this.markers = []
    this.groupMarkers = []

    const markers = data.clusters && data.clusters.length ? data.clusters.map(cluster => this.createServerCluster(cluster)) : data.items.map(item => this.createPhotoMarker(item))
    this.markers = markers
    this.clusterer.addMarkers(markers)
  }

  createPhotoMarker(data) {
    const content = this.markerTemplate.cloneNode(true)
    content.data = data
    content.id = `marker-${data.mid}`

    return new this.marker.AdvancedMarkerElement({
      map: this.map,
      position: { lat: data.location.lat, lng: data.location.lon },
      content,
    })
  }

  createServerCluster(data) {
    const content = this.markerTemplate.cloneNode(true)
    content.isESCluster = true
    content.data = data
    content.id = `marker-${data.key}`
    content.classList.add("is-multiple", "is-es-cluster")
    content.addEventListener("click", this.boundOnClusterClick)

    return new this.marker.AdvancedMarkerElement({
      map: this.map,
      position: { lat: data.center.location.lat, lng: data.center.location.lon },
      content,
    })
  }

  renderClusterMarker(cluster) {
    const data = []
    let counter = 0
    let containsESCluster = false

    cluster.markers.forEach(marker => {
      const content = marker.content
      if (content.isESCluster) {
        data.push(content.data)
        counter += content.data.doc_count
        containsESCluster = true
      } else {
        data.push(content.data)
        counter += 1
      }
    })

    if (data[0].year) data.sort((a, b) => a.year - b.year)

    const content = this.markerTemplate.cloneNode(true)
    content.isGroup = true
    content.containsESCluster = containsESCluster
    content.data = data
    content.counter = counter
    content.id = `marker-${data[0].mid}-${data[data.length - 1].mid}-${data.length}`
    content.classList.add("is-multiple")
    content.cluster = cluster
    content.addEventListener("click", this.boundOnClusterClick)

    const marker = new this.marker.AdvancedMarkerElement({
      map: this.map,
      position: cluster.position,
      content,
      gmpClickable: true,
    })
    this.groupMarkers.push(marker)
    return marker
  }

  onClusterClick(e) {
    if (!e.target.classList.contains("map-cluster-marker")) return

    const content = e.target.parentElement
    if (content.isESCluster) {
      this.map.fitBounds(this.geotileToBounds(content.data.key))
    } else if (content.isGroup && content.cluster) {
      if (content.mapMarker && content.mapMarker.showPreview()) return
      this.clusterer.defaultOnClusterClick(e, content.cluster, this.map)
    }
  }

  onMarkerPhotoSelected(e) {
    const photoData = e.detail && e.detail.photoData
    const photoId = e.detail && e.detail.photoId
    if (!photoData || !photoId) return

    const photo = photoData.find(item => item.mid.toString() === photoId.toString())
    if (!photo) return

    photoManager.selectPhotoById(photoId)
    trigger("photosThumbnail:select", { data: photo })
  }

  geotileToBounds(key) {
    const [zoom, x, y] = key.split("/").map(Number)
    const tileCount = 2 ** zoom
    const tileToLat = tileY => {
      const radians = Math.PI - (2 * Math.PI * tileY) / tileCount
      return (180 / Math.PI) * Math.atan(Math.sinh(radians))
    }

    return {
      west: (x / tileCount) * 360 - 180,
      east: ((x + 1) / tileCount) * 360 - 180,
      north: tileToLat(y),
      south: tileToLat(y + 1),
    }
  }

  updateHistory(params) {
    const center = this.map.getCenter()
    const query = new URLSearchParams(params)
    query.delete("gb")
    query.delete("size")
    query.delete("clustered")
    query.delete("disableAggregatedYears")
    query.set("gc", `${center.lat().toFixed(4)},${center.lng().toFixed(4)}`)
    query.set("gz", Math.round(this.map.getZoom()).toString())
    const url = `/${getLocale()}/map/?${query.toString()}`
    if (window.location.pathname + window.location.search !== url) {
      window.history.pushState(null, null, url)
    }
  }

  onPopState() {
    if (!this.map) return
    const params = getURLParams()
    if (params.gc) {
      const [lat, lng] = params.gc.split(",").map(Number)
      this.map.setCenter({ lat, lng })
    }
    if (params.gz) this.map.setZoom(Number(params.gz))

    // the search may have changed too, so refresh the field and the markers
    trigger("search:syncWithURL")
    this.load()
  }

  toggleMapStyles() {
    if (!this.map) return

    const center = this.map.getCenter()
    const zoom = this.map.getZoom()
    this.clusterer.clearMarkers()
    this.markers.forEach(marker => {
      marker.map = null
    })
    this.groupMarkers.forEach(marker => {
      marker.map = null
    })
    this.map = null
    this.mapTarget.innerHTML = ""

    requestAnimationFrame(() => {
      this.initMap().then(() => {
        this.map.setCenter(center)
        this.map.setZoom(zoom)
      })
    })
  }
}
