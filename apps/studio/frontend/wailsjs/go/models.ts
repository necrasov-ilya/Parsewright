export namespace main {
	
	export class ExtractRequest {
	    url: string;
	    goal: string;
	    heuristic: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ExtractRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.goal = source["goal"];
	        this.heuristic = source["heuristic"];
	    }
	}

}

