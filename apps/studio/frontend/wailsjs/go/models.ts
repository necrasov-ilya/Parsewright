export namespace main {
	
	export class ExtractRequest {
	    url: string;
	    goal: string;
	    provider: string;
	    baseUrl: string;
	    model: string;
	    apiKey: string;
	    maxItems: number;
	    mode: string;
	
	    static createFrom(source: any = {}) {
	        return new ExtractRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.goal = source["goal"];
	        this.provider = source["provider"];
	        this.baseUrl = source["baseUrl"];
	        this.model = source["model"];
	        this.apiKey = source["apiKey"];
	        this.maxItems = source["maxItems"];
	        this.mode = source["mode"];
	    }
	}

}

