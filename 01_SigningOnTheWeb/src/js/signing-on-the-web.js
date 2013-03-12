/////////////////////////////////
// Create global namespace
var gfx = {};

////////////////////////////////
// Define filters for image processing
// 
// When working with Canvas ImageData, each channel is an 8-bit byte (0-255)
// Pixels are stored in ImageData.data as an array of pixel channels (rgba), this every 4 items in the array equal 1 pixel.
gfx.Filter = {
    desaturate: function(imageData) {
        var data = imageData.data;

        for (var i = 0, length = data.length; i < length; i += 4) {
            //Create a "gray" value by averaging all three channels
            var gray = (0.21 * data[i] + 0.71 * data[i+1] + 0.07 * data[i+2]);
            
            //Set all three color channels the same to produce a grey
            data[i + 0] = gray; //r
            data[i + 1] = gray; //g
            data[i + 2] = gray; //b
            data[i + 3] = 255;  //alpha
        }

        return imageData;
    },

    multiply: function(imageData) {
        var data = imageData.data;

        for (var i = 0, length = data.length; i < length; i += 4) {
            data[i + 0] = data[i + 0] * data[i + 0] / 255;
            data[i + 1] = data[i + 1] * data[i + 1] / 255;
            data[i + 2] = data[i + 2] * data[i + 2] / 255;
            data[i + 3] = 255;
        }

        return imageData;
    },

    brightness: function(imageData, brightness) {
        brightness = brightness ? brightness : 1.25; //set default

        var data = imageData.data;

        for (var i = 0, length = data.length; i < length; i += 4) {
            data[i + 0] = Math.min(255, data[i + 0] * brightness);
            data[i + 1] = Math.min(255, data[i + 1] * brightness);
            data[i + 2] = Math.min(255, data[i + 2] * brightness);
            data[i + 3] = 255;
        }

        return imageData;
    },

    //threshold : required int 0-255 determines which "whites" get knocked out
    //rgb : optional object {r, g, b} will fill each visible pixel
    extract: function(imageData, threshold, rgb) {
        threshold = threshold ? threshold : 200;
        rgb = rgb ? rgb : {r:0, g:67, b:124};

        var data = imageData.data;

        for (var i = 0, length = data.length; i < length; i += 4) {
            //Theshold check against red channel. 
            //This is assuming that the image is greyscale, thus all three channels are the same
            if (data[i] > threshold) { 
                //This pixel is "whiter" than the threshold - make transparent
                data[i + 3] = 0;
            } else {
                //This pixel is visible so fill it with optional rgb, or complete black
                data[i + 0] = rgb ? rgb.r : 0;
                data[i + 1] = rgb ? rgb.g : 0;
                data[i + 2] = rgb ? rgb.b : 0;
                data[i + 3] = 255;
            }
        }

        return imageData;
    },
};




////////////////////////////////
// Define drawing class
// 
gfx.Draw = {
    canvas: null,
    displayContext: null,
	
	bufferCanvas: null,
	bufferContext: null,
    
    points: null,
    curves: [],
    isDrawing: false,

    strokeColor: '#0d3d78',
    strokeThickness: 10,
    strokeThicknessMultiplier : 2.35,
	
    isAwesome: false,
	pools: false,
	poolDrips: false,
	splatters: false,
	
	lastMoveTime: 0,
	lastDist: 0,
	drips: [],

    strokes : new Array(
        {tol:0.350, width:0.81},
        {tol:0.300, width:0.83},
        {tol:0.250, width:0.86},
        {tol:0.200, width:0.9},
        {tol:0.150, width:0.93},
        {tol:0.100, width:0.96},
        {tol:0.095, width:0.99},
        {tol:0.090, width:1.3},
        {tol:0.085, width:1.4},
        {tol:0.080, width:1.6},
        {tol:0.075, width:1.8},
        {tol:0.070, width:1.9},
        {tol:0.065, width:2.1},
        {tol:0.060, width:2.3},
        {tol:0.055, width:2.5},
        {tol:0.050, width:2.7},
        {tol:0.045, width:2.9},
        {tol:0.040, width:3.1},
        {tol:0.035, width:3.3},
        {tol:0.030, width:3.5},
        {tol:0.025, width:3.7},
        {tol:0.020, width:3.9},
        {tol:0.015, width:4.1},
        {tol:0.010, width:4.3},
        {tol:0.005, width:4.5},
        {tol:0.001, width:4.7}
    ),

    initialize: function(canvas) {
        this.canvas = canvas;
        this.displayContext = this.canvas.get(0).getContext('2d');
		
		this.bufferCanvas = $('<canvas width="'+this.canvas.width()+'" height="'+this.canvas.height()+'"></canvas>');
		this.bufferContext = this.bufferCanvas.get(0).getContext('2d');

        //Set up all the event handlers
		var hasTouch = ("ontouchstart" in window);
        this.canvas.bind(hasTouch ? 'touchstart' : 'mousedown', $.proxy(this.eventStart, this));
        this.canvas.bind(hasTouch ? 'touchmove' : 'mousemove', $.proxy(this.eventMove, this));
		
        $(document).bind(hasTouch ? 'touchend' : 'mouseup', $.proxy(this.eventStop, this)); //bind mouseup on document in case the user releases mouse button away from canvas

        this.clear();
    },

    eventStart: function(event) {
        this.isDrawing = true;
		
		this.points = [];
		this.curves.push(this.points);

		var cursor = ("touches" in event) ? event.touches[0] : event;
        this.lastX = Math.floor(cursor.pageX - this.canvas.offset().left);
        this.lastY = Math.floor(cursor.pageY - this.canvas.offset().top);
		
        this.points.push({x:this.lastX, y:this.lastY, k:1});
		this.lastDist = 0;
		
		if (window.requestAnimationFrame){
			this.lastMoveTime = new Date().getTime();
			requestAnimationFrame($.proxy(this.eventFrame, this));
		}
		
		event.preventDefault();
    },

    eventMove: function(event) {
        if (!this.isDrawing) {
            return;
        }
		
		var cursor = ("touches" in event) ? event.touches[0] : event;
        var x = Math.floor(cursor.pageX - this.canvas.offset().left);
        var y = Math.floor(cursor.pageY - this.canvas.offset().top);
		
		if (this.drips.length !== 0){
			this.drips.length = 0;
			this.bufferContext.clearRect(0,0,this.canvas.width(), this.canvas.height());
			this.bufferContext.drawImage(this.canvas.get(0), 0, 0);
		}
		
		this.drawPoint(x, y, this.bufferContext);
		
		this.lastMoveTime = new Date().getTime();
		event.preventDefault();
	},
	
	eventFrame: function(){
		var idleTime = new Date().getTime() - this.lastMoveTime;
		this.displayContext.clearRect(0,0,this.canvas.width(), this.canvas.height());
		
		if (this.pools && idleTime > 100){
			this.poolInk(idleTime, this.bufferContext);
		}
		
		this.displayContext.drawImage(this.bufferCanvas.get(0), 0, 0);
		
		if (this.isDrawing){
			requestAnimationFrame($.proxy(this.eventFrame, this));
		}else{
			this.eventsComplete();
		}
	},

    eventStop: function(event) {
		// make it so single clicks still draw
		// gotta dot those i's
		if (this.points && this.points.length === 1){
			this.drawPoint(this.lastX, this.lastY + 1, this.bufferContext);
			if (this.isAwesome){
				// two points are used so a full
				// curve can be drawn
				this.drawPoint(this.lastX + 1, this.lastY, this.bufferContext);
			}
		}
		
		// copy buffer into main drawing
		this.displayContext.clearRect(0,0,this.canvas.width(), this.canvas.height());
		this.displayContext.drawImage(this.bufferCanvas.get(0), 0, 0);
		
		this.isDrawing = false;
		event.preventDefault();
    },
	
	eventsComplete: function(){
		// clear out any drips
		this.drips.length = 0;
		
		// copy current display into main drawing buffer
		this.bufferContext.clearRect(0,0,this.canvas.width(), this.canvas.height());
		this.bufferContext.drawImage(this.canvas.get(0), 0, 0);
		
	},
	
	drawPoint: function(x, y, context){
        
        var distance = this.distance(this.lastX, this.lastY, x, y);

		var thick = this.strokeThickness;
        if (this.isAwesome){
        	thick = this.calcStrokeWidth(distance / this.canvas.width()*2);	
		}else{
			
			context.beginPath();
			context.moveTo(this.lastX, this.lastY);
			context.lineTo(x, y);
			context.lineWidth = thick;
			context.stroke();
		}
		
        this.lastX = x;
        this.lastY = y;
        this.points.push({x:this.lastX, y:this.lastY, k:thick});
		
		if (this.splatters){
			this.calcSplatter(context);
		}
		
        if (this.isAwesome){
			this.drawSmoothPath(context);
		}
		
		this.lastDist = distance;
    },

    drawSmoothPath: function(context) {
		if (!this.points){
			return;
		}
		
		// at least 3 points are needed to make a curve
		if (this.points.length > 2){
			
			var index = this.points.length - 2;
			var sp = this.getCurveEndPoint(index - 1);
			var ep = this.getCurveEndPoint(index);
			
			this.drawDividedSmoothPath(sp, this.points[index], ep, context);
		}
    },

    drawDividedSmoothPath: function(p1, cp, p2, context) {
		
		var dk = p2.k - p1.k; // line weight difference
		
		// divisions based on variation in thickness
		var divs = 1 + Math.floor(Math.abs(dk)*5); // arbitrary multiplier for smoother transitions
		
		// deltas for each division
		dk /= divs;
		
		// bezier curve
		var b = [p1.x, p1.y, cp.x, cp.y, p2.x, p2.y];
		var t1 = 0; // slice from
		var t2 = 0; // slice to
		
		context.beginPath();
		context.moveTo(p1.x, p1.y);
		
		var i = 0;
		for (i = 1; i <= divs; i++){
			
			t2 = i/divs;
			
			// copy original point locations back in bezier object
			b[0] = p1.x; b[1] = p1.y; b[2] = cp.x; b[3] = cp.y; b[4] = p2.x; b[5] = p2.y;
			// slice bezier between the divisions in the loop
			this.curveSlice(b, t1, t2);
			
			context.lineWidth = p1.k + dk * i;
			context.quadraticCurveTo(b[2], b[3], b[4], b[5]);
			context.stroke();
			
			// prepare next path in loop
			context.beginPath();
			context.moveTo(b[4], b[5]);
			
			t1 = t2;
		}
		
		// update next start point to
		// this end point
		p1.x = b[4];
		p1.y = b[5];
		p1.k = p2.k;
    },
	
	getCurveEndPoint: function(index){
		return {	x: (this.points[index].x + this.points[index + 1].x) / 2,
					y: (this.points[index].y + this.points[index + 1].y) / 2,
					k: this.points[index + 1].k };
	},
	
	// bezier is an array of 6 numbers starting with 
	// x,y of start point, then x,y of control followed
	// by x,y of end point
	curveSlice: function(bezier, t1, t2) {
		if (t1 === 0){
			this.curveSliceUpTo(bezier, t2);
		}else if (t2 === 1){
			this.curveSliceFrom(bezier, t1);
		}else{
			this.curveSliceUpTo(bezier, t2);
			this.curveSliceFrom(bezier, t1/t2);
		}
	},
	
	curveSliceUpTo: function(bezier, t) {
		if (t !== 1) {
			var mx = bezier[2] + (bezier[4]-bezier[2])*t;
			var my = bezier[3] + (bezier[5]-bezier[3])*t;
			bezier[2] = bezier[0] + (bezier[2]-bezier[0])*t;
			bezier[3] = bezier[1] + (bezier[3]-bezier[1])*t;
			bezier[4] = bezier[2] + (mx-bezier[2])*t;
			bezier[5] = bezier[3] + (my-bezier[3])*t;
		}
	},
	
	curveSliceFrom: function(bezier, t) {
		if (t !== 1) {
			var mx = bezier[0] + (bezier[2]-bezier[0])*t;
			var my = bezier[1] + (bezier[3]-bezier[1])*t;
			bezier[2] = bezier[2] + (bezier[4]-bezier[2])*t;
			bezier[3] = bezier[3] + (bezier[5]-bezier[3])*t;
			bezier[0] = mx + (bezier[2]-mx)*t;
			bezier[1] = my + (bezier[3]-my)*t;
		}
	},
	
	calcSplatter: function(context){
		// need at least 3 points to compare
		if (!this.points || this.points.length < 3){
			return;
		}
		
		// last 3 points
		var last = this.points.length - 1;
		var a = this.points[last - 2];
		var b = this.points[last - 1];
		var c = this.points[last];
		
		var angle = Math.atan2(b.y - a.y, b.x - a.x);
		var da = Math.abs(angle - Math.atan2(c.y - b.y, c.x - b.x));
		if (da > Math.PI){
			da = Math.PI*2 - da;
		}
		
		var angleToler = Math.PI * 0.25; // need hard angle to splat
		var distToler = 5; // should be moving pen fast to splat
		
		// check for angle between points and
		// distance to see if a splat should occurr
		if (da > angleToler && this.lastDist > distToler){
			this.drawSpatter(b, angle, this.lastDist, context); 
		}
		
	},
	
	drawSpatter: function(pt, angle, dist, context){
		var numSplat = 1 + Math.floor(Math.random() * 4);
		var spread = 0.6; // from angle
		var weightMul = 0.5; // factor from current ink
		var minWeight = 3; 
		var offMul = 0.5; // offset
		var strengthMul = 2; // offset
		var maxStrength = 50;
		var strengthVar = 0.5;
		var endWeight = 0.3;
		var cpMul = 0.1; // control loc (ink distribution)

		var sp = null; // start point
		var cp = null; // control point
		var ep = null; // end point
		var dir = 0;
		var strength = 0;
		var dx = 0;
		var dy = 0;
		var offx = 0;
		var offy = 0;
		
		var i = 0;
		for (i=0; i<numSplat; i++){
			// direction is based off angle +/- some random spread
			dir = angle + spread * Math.random() - spread/2;
			// strength is based off of distance
			strength = Math.min(maxStrength, strengthMul * (dist + dist * Math.random()));
			dx = strength * Math.cos(dir);
			dy = strength * Math.sin(dir);
			
			// offset strength more randomized starting
			// from the drawn line (and based on splat strength)
			strength = pt.k*weightMul + offMul * strength * Math.random();
			offx = strength * Math.cos(dir);
			offy = strength * Math.sin(dir);
			// ink weight is based on the current path
			// but reduced to not be too noisy
			sp = { x:pt.x + offx, y:pt.y + offy, k:Math.max(minWeight, pt.k * weightMul) };
			cp = { x:sp.x + dx * cpMul, y:sp.y + dy * cpMul, k:0 };
			ep = { x:sp.x + dx, y:sp.y + dy, k:endWeight };
			this.drawDividedSmoothPath(sp, cp, ep, context);
		}
	},
	
	poolInk: function(idleTime, context){
		if (this.points.length){
			// get the last point to pool ink into
			var pt = this.points[this.points.length - 1];
			
			// if this point doesn't have a base weight
			// it will be replaced with a new point that
			// does. This also catches up the line with the
			// current location of the mouse if not already there
			if (!pt.baseK){
				this.drawPoint(this.lastX, this.lastY + 1, context);
				
				// if there's not enough points for a curve
				// we need yet another point
				if (this.points.length === 2){
					this.drawPoint(this.lastX + 1, this.lastY + 1, context);
				}
			
				// re-obtain last point for pooling
				pt = this.points[this.points.length - 1];
					
				// baseK identifies a pooled point and
				// is used to determine pooling ink
				pt.baseK = pt.k;
			}
			
			// new weight is based on time not
			// moving the mouse reduced by a factor
			// including the current size to reduce
			// scaling at larget sizes
			var poolWeightMult = 5;
			pt.k = pt.baseK + idleTime/(pt.k * poolWeightMult);
			this.drawSmoothPath(context);
			
			if (this.poolDrips){
				this.dripInk(pt, idleTime);
			}
		}
	},
	
	dripInk: function(pt, idleTime){
		if (idleTime < 1000){
			return;
		}
		
		if (this.drips.length === 0){
			this.addDrips(pt);
		}
		
		var i = 0;
		var n = this.drips.length;
		for (i=0; i<n; i++){
			this.drips[i].d += this.drips[i].s * ((300-this.drips[i].d)/300);
			this.drawDrip(this.drips[i], this.displayContext);
		}
	},
	
	addDrips: function(pt){
		var count = 1+Math.floor(Math.random()*4);
		while(count--){
			this.drips.push({
				x:pt.x + 0.5*pt.k - Math.random()*pt.k, 
				y:pt.y, 
				d:0, 
				s:0.1+Math.random(), 
				k:2+Math.random()*4 });
		}
	},
	
	drawDrip: function(drip, context){
		var sp = {x:drip.x, y:drip.y, k:0.1};
		var ep = {x:drip.x, y:drip.y + drip.d, k:drip.k};
		var cp = {x:drip.x, y:ep.y};
		this.drawDividedSmoothPath(sp, cp, ep, context);
	},
    
    clear: function() {
        if (this.canvas && this.displayContext) {
			this.curves.length = 0;
            this.points = null;

            //Reset context and line styles
            this.bufferContext.clearRect(0, 0, this.canvas.width(), this.canvas.height());
            this.displayContext.clearRect(0, 0, this.canvas.width(), this.canvas.height());
            this.displayContext.strokeStyle = this.bufferContext.strokeStyle = this.strokeColor;
            this.displayContext.lineCap = this.bufferContext.lineCap = "round";
            this.displayContext.lineWidth = this.bufferContext.lineWidth = this.strokeThickness;
        }
        this.imageData = null;
    },

    calcStrokeWidth: function(distance) {
        var strokeWidth = 3;
        for (var i = 0; i < this.strokes.length; i++) {
            if (distance <= this.strokes[i].tol) {
                strokeWidth = this.strokes[i].width;
            }
        }
        return strokeWidth * this.strokeThicknessMultiplier;
    },
    
    distance: function(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },

    toImage: function() {
        return $('<img src="' + this.canvas.get(0).toDataURL() + '"/>');
    },
    
    toggleAwesomePen: function() {
        this.isAwesome = !this.isAwesome;
    },
    
    togglePooling: function() {
        this.pools = !this.pools;
    },
    
    togglePoolingDrips: function() {
        this.poolDrips = !this.poolDrips;
    },
    
    toggleSplatter: function() {
        this.splatters = !this.splatters;
    }
};
