export namespace main {
	
	export class CodeGenRequest {
	    manifest: Record<string, any>;
	    language: string;
	    includeDocs: boolean;
	    extraRequirements: string;
	    provider: string;
	    baseUrl: string;
	    model: string;
	    apiKey: string;
	    heuristic: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CodeGenRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.manifest = source["manifest"];
	        this.language = source["language"];
	        this.includeDocs = source["includeDocs"];
	        this.extraRequirements = source["extraRequirements"];
	        this.provider = source["provider"];
	        this.baseUrl = source["baseUrl"];
	        this.model = source["model"];
	        this.apiKey = source["apiKey"];
	        this.heuristic = source["heuristic"];
	    }
	}
	export class ExtractRequest {
	    url: string;
	    goal: string;
	    dialogId?: number;
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
	        this.dialogId = source["dialogId"];
	        this.provider = source["provider"];
	        this.baseUrl = source["baseUrl"];
	        this.model = source["model"];
	        this.apiKey = source["apiKey"];
	        this.maxItems = source["maxItems"];
	        this.mode = source["mode"];
	    }
	}
	export class ResetResponse {
	    ok: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ResetResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	    }
	}

}

