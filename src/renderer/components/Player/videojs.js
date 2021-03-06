/**
 * A mixin that wraps up videojs control.
 * This mixin can be added to the Player component to use and control videojs
 */

import AudioPan from './AudioPan'

require('videojs-contrib-media-sources')
require('videojs-contrib-hls.js')
require('dashjs/dist/dash.all.min.js')
require('videojs-contrib-dash/dist/videojs-dash.min.js')
require('videojs-youtube/dist/Youtube.min.js')
require('videojs-flash/dist/videojs-flash.js')
require('./../../../js/videojs-vimeo.min.js')
// #if process.env.BUILD_TARGET != 'web'
require('videojs-swf/dist/video-js.swf')
// #endif
const { PlayerEvents } = require('./PlayerEvents')

export default {
    data () {
        return {
            player: null,
            settings: {
                liveWindow: 40
            },
            tech: null,
            streamInfo: {
                url: '',
                volume: 0,
                currentTime: 0,
                currentHHMMSS: '',
                durationHHMMSS: '',
                duration: 0,
                position: 0,
                qualities: [],
                isLiveStream: false,
                isPlayingLive: false
            }
        }
    },
    mounted () {
        if (this.player == null) {
            this.player = window.videojs(this.$el.querySelector('video'), {
                techOrder: ['html5', 'youtube', 'vimeo', 'flash'],
                html5: {
                    hlsjsConfig: {
                        debug: false
                    }
                },
                // #if process.env.BUILD_TARGET != 'web'
                flash: {
                    swf: '../node_modules/videojs-swf/dist/video-js.swf'
                },
                // #endif
                autoplay: true,
                controls: false,
                loop: false,
                children: ['video', 'mediaLoader']
            })
            // // redirect player events to our Vue component
            // var vjsEvents = [
            //     'volumechange', 'timeupdate'
            //     // 'progress', 'abort', 'suspend', 'emptied', 'stalled',
            //     // 'loadedmetadata', 'loadeddata', , 'ratechange',
            //     // 'resize', 'texttrackchange',
            //     // tech events
            //     // 'loadstart', 'waiting', 'canplay', 'canplaythrough', 'playing',
            //     // 'ended', 'seeking', 'seeked', 'play', 'firstplay', 'pause',
            //     // 'durationchange', 'fullscreenchange', 'error', 'loadedmetadata',
            //     // 'posterchange', 'textdata',
            //     // tech listeners
            //     // 'mousedown', 'touchstart', 'touchmove', 'touchend', 'tap'
            //     // misc
            //     // 'pause', 'enterFullWindow', 'exitFullWindow', 'controlsenabled', 'controlsdisabled',
            //     // 'usingnativecontrols', 'usingcustomcontrols', 'useractive', 'userinactive', 'dispose'
            // ]

            // expose vjs events
            var vjsEvents = [ 'loadstart', 'loadedmetadata', 'timeupdate', 'volumechange' ]
            for (var i = 0; i < vjsEvents.length; i++) {
                this.player.on(vjsEvents[i], this.redirectPlayerEvent)
            }

            // handle incoming events
            PlayerEvents.$on('aspectRatio', this.aspectRatio)
            PlayerEvents.$on('play', this.play)
            PlayerEvents.$on('pause', this.pause)
            PlayerEvents.$on('stop', this.stop)
            PlayerEvents.$on('seek', this.seek)
            PlayerEvents.$on('seekTo', this.seekTo)
            PlayerEvents.$on('seekNormalize', this.seekNormalize)
            PlayerEvents.$on('playbackRate', this.playbackRate)
            PlayerEvents.$on('setQualityIndex', this.setQualityIndex)
            PlayerEvents.$on('goLive', this.goLive)
            PlayerEvents.$on('volume', this.volume)
            PlayerEvents.$on('toggleMute', this.toggleMute)
            PlayerEvents.$on('setAudioPan', this.setAudioPan)
            PlayerEvents.$on('pip', this.togglePip)

            console.log('video component ready.')
        }
    },
    beforeDestroy () {
        PlayerEvents.$off('aspectRatio', this.aspectRatio)
        PlayerEvents.$off('play', this.play)
        PlayerEvents.$off('pause', this.pause)
        PlayerEvents.$off('stop', this.stop)
        PlayerEvents.$off('seek', this.seek)
        PlayerEvents.$off('seekTo', this.seekTo)
        PlayerEvents.$off('seekNormalize', this.seekNormalize)
        PlayerEvents.$off('playbackRate', this.playbackRate)
        PlayerEvents.$off('setQualityIndex', this.setQualityIndex)
        PlayerEvents.$off('goLive', this.goLive)
        PlayerEvents.$off('volume', this.volume)
        PlayerEvents.$off('toggleMute', this.toggleMute)
        PlayerEvents.$off('setAudioPan', this.setAudioPan)
        PlayerEvents.$off('pip', this.togglePip)
    },
    methods: {
        aspectRatio (ratio) {
            // keep (fit), crop (fill), off (stretch)
            this.player.aspectRatio(ratio)
        },
        currentTime () {
            return this.player.currentTime()
        },
        duration () {
            var time = this.player.seekable()
            if (time && time.length) {
                // set updated duration
                this.player.duration(this.player.seekable().end(0))
            }
            return this.player.duration()
        },
        dvrWindow () {
            if (this.player.seekable() && this.player.seekable().length) {
                return this.player.seekable().end(0) - this.player.seekable().start(0)
            }
            return this.player.duration()
        },
        isPlayingLive () {
            return this.duration() - this.currentTime() < this.settings.liveWindow
        },
        isLiveStream () {
            return this.streamInfo.isLiveStream || false
        },
        goLive () {
            if (this.player.seekable()) {
                this.player.currentTime(this.player.seekable().end(0))
            } else {
                this.seekTo(this.player.duration())
            }
        },
        pause () {
            if (this.paused()) {
                this.player.play()
            } else {
                this.player.pause()
                this.$emit('pause')
            }
        },
        paused () {
            return this.player.paused()
        },
        playing () {
            return this.player.playing
        },
        playbackRate (rate) {
            this.player.playbackRate(rate)
            PlayerEvents.$emit('playbackratechange', rate)
        },
        play (src) {
            if (this.playing()) this.stop()
            if (src.indexOf('.m3u8') >= 0) {
                // HLS
                this.player.src({ src: src, type: 'application/x-mpegURL' })
            } else if (src.indexOf('.mp4') >= 0) {
                // MP4
                this.player.src({ src: src, type: 'video/mp4' })
            } else if (src.indexOf('.webm') >= 0) {
                this.player.src({ src: src, type: 'video/webm' })
            } else if (src.indexOf('.ism') >= 0) {
                // MSS
                this.player.src({ src: src, type: 'application/ttml+xml+mp4' })
            } else if (src.indexOf('.mpd') >= 0 || (src.indexOf('.ism') >= 0 && src.indexOf('format=mpd') >= 0)) {
                // DASH
                this.player.src({ src: src, type: 'application/dash+xml' })
            } else if (src.indexOf('youtube.com') >= 0) {
                // YOUTUBE
                this.player.src({ src: src, type: 'video/youtube' })
            } else if (src.indexOf('vimeo.com') >= 0) {
                // VIMEO
                this.player.src({ src: src, type: 'video/vimeo' })
            } else if (src.indexOf('rtmp://') >= 0) {
                // RTMP
                this.player.src({ src: src, type: 'rtmp/mp4' })
            } else if (src.indexOf('.f4m') >= 0) {
                // HDS
                this.player.src({ src: src, type: 'application/f4m' })
            } else {
                console.warn('unsupported video source')
            }
            this.streamInfo.url = this.player.currentSrc() || ''
            this.player.play()
        },
        redirectPlayerEvent (event) {
            if (event.type === 'loadstart') {
                // hook player tech for audio pan
                this.tech = this.player.tech({ IWillNotUseThisInPlugins: true })
                console.dir(this.tech)
                AudioPan.init(this.tech.el())
            } else if (event.type === 'loadedmetadata') {
                PlayerEvents.$emit('delayedseek')
                if (this.tech && this.tech.hls) {
                    console.log('HLS tech')
                    this.streamInfo.isLiveStream = !this.tech.hls.playlists.media().endList
                    for (var i = 0; i < this.tech.hls.representations().length; i++) {
                        this.streamInfo.qualities.unshift({
                            id: this.streamInfo.qualities.length,
                            uri: this.tech.hls.representations()[i].id,
                            label: this.tech.hls.representations()[i].height + 'p (' + this.convertBytes(this.tech.hls.representations()[i].bandwidth) + ')',
                            bandwidth: this.tech.hls.representations()[i].bandwidth,
                            width: this.tech.hls.representations()[i].width,
                            height: this.tech.hls.representations()[i].height
                        })
                    }
                } else {
                    console.log('unknown tech')
                    this.streamInfo.isLiveStream = this.isLiveStream()
                }
            } else if (event.type === 'timeupdate') {
                this.streamInfo.currentTime = (this.currentTime() !== undefined) ? this.currentTime() : -1
                this.streamInfo.duration = (this.duration() !== undefined) ? this.duration() : -1
                this.streamInfo.currentHHMMSS = (this.streamInfo.currentTime !== -1) ? this.toHHMMSS(this.streamInfo.currentTime) : ''
                this.streamInfo.durationHHMMSS = (this.streamInfo.duration !== -1) ? this.toHHMMSS(this.streamInfo.duration) : ''
                this.streamInfo.position = (this.streamInfo.currentTime !== -1 && this.streamInfo.duration !== -1) ? this.streamInfo.currentTime / this.streamInfo.duration : 0
                if (this.isPlayingLive() !== this.streamInfo.isPlayingLive) {
                    PlayerEvents.$emit((this.isPlayingLive) ? 'live' : 'notlive')
                    this.streamInfo.isPlayingLive = this.isPlayingLive()
                }
                // show some debug info
                if (document.getElementById('debug')) {
                    document.getElementById('debug').innerHTML = `
                    <p>url: ` + this.streamInfo.url + `</p>
                    <p>currentTime: ` + this.streamInfo.currentTime + `</p>
                    <p>duration: ` + this.streamInfo.duration + `</p>
                    <p>currentHHMMSS: ` + this.streamInfo.currentHHMMSS + `</p>
                    <p>durationHHMMSS: ` + this.streamInfo.durationHHMMSS + `</p>
                    <p>position: ` + this.streamInfo.position + `</p>
                    <p>isLiveStream: ` + this.streamInfo.isLiveStream + `</p>
                    <p>isPlayingLive: ` + this.streamInfo.isPlayingLive + `</p>
                    <p>qualities: ` + this.streamInfo.qualities.length + `</p>
                    `
                }
            } else if (event.type === 'volumechange') {
                this.streamInfo.volume = this.player.volume()
            }
            PlayerEvents.$emit('streamInfo', this.streamInfo)
        },
        convertBytes (b) {
            if (b < 1024) return b + 'B'
            if (b < 1024000) return Math.round(b / 1024) + 'KB'
            if (b < 1024000000) return Math.round(b / 1024000) + 'MB'
        },
        remainingTime () {
            return this.player.remainingTime()
        },
        seek (secs) {
            if (this.player.duration() <= 0) return
            if (this.player.currentTime() + secs < this.player.duration()) {
                this.player.currentTime(this.player.currentTime() + secs)
                this.$emit('seek')
            }
        },
        seekTo (secs) {
            if (secs < this.player.duration()) {
                this.player.currentTime(secs)
                this.$emit('seekTo')
            }
        },
        seekNormalize (normalize) {
            this.seekTo(this.player.duration() * normalize)
        },
        seeking () {
            return this.player.seeking()
        },
        setAudioPan (which) {
            AudioPan.pan(which)
        },
        setQualityIndex (idx) {
            console.log('no quality index implementation yet')
        },
        setMuted (muted) {
            this.player.muted(muted)
            PlayerEvents.$emit('muted', muted)
        },
        toggleMute () {
            this.setMuted(!this.player.muted())
        },
        volume (val) {
            if (val) this.player.volume(val)
            return this.player.volume()
        },
        stop () {
            if (!this.paused()) this.player.pause()
            this.player.reset()
            this.streamInfo = {
                volume: 0,
                currentTime: 0,
                currentHHMMSS: '',
                durationHHMMSS: '',
                duration: 0,
                position: 0,
                qualities: [],
                isLiveStream: false,
                isPlayingLive: false
            }
        },
        toHHMMSS (sec) {
            var secs = parseInt(sec, 10)
            var hours = Math.floor(secs / 3600)
            var minutes = Math.floor((secs - (hours * 3600)) / 60)
            var seconds = secs - (hours * 3600) - (minutes * 60)

            if (hours < 10) hours = '0' + hours
            if (minutes < 10) minutes = '0' + minutes
            if (seconds < 10) seconds = '0' + seconds
            return hours + ':' + minutes + ':' + seconds
        },
        togglePip () {
            if (this.$el.classList.contains('pip')) {
                this.$el.classList.remove('pip')
            } else {
                this.$el.classList.add('pip')
            }
        }
    }
}
