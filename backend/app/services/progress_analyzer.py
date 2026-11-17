TOPIC_MODULES = {
 "Encoding":["lab0","framing"], "Framing":["framing"], "Errors":["errors"],
 "ARQ":["saw","window"], "Subnetting":["subnets"], "IP":["ipheaders","routing","subnets"],
 "Routing":["routing"], "TCP":["tcpudp","handshake","congestion","sockets"],
 "DNS":["dns"], "HTTP":["http"], "TLS":["http"], "NAT":["ipheaders","firewall"], "Sockets":["sockets"]
}

def analyze_progress(progress=None):
    p=progress or {}; visited=p.get("visited") or {}; flags=p.get("flags") or {}; stats=p.get("stats") or {}
    runs=p.get("runs") or []; done=set()
    checks=[
      (["Encoding","Framing"],lambda:all(flags.get(k) for k in ("typed","psMoved","transmitted","rebuilt"))),
      (["ARQ","IP"],lambda:any((r.get("loss") or 0)>=30 for r in runs) and flags.get("retry") and any(not r.get("ok") for r in runs) and flags.get("viewedGap")),
      (["Errors"],lambda:all(flags.get(k) for k in ("errflip","parityMiss","crcCatch","trials"))),
      (["Subnetting"],lambda:flags.get("cidr20") and int(stats.get("subnetOk") or 0)>=3),
      (["ARQ","TCP"],lambda:all(flags.get(k) for k in ("saw","window","gbnBreak"))),
      (["TCP","TLS","HTTP"],lambda:all(flags.get(k) for k in ("handshake","filter","diagnosed","ecdh")))]
    for topics,check in checks:
        try:
            if check(): done.update(topics)
        except (TypeError,ValueError,AttributeError): pass
    topics=[]
    for topic,ids in TOPIC_MODULES.items():
        activity=sum(bool(visited.get(i)) for i in ids)/len(ids)
        tutorial=int(topic in done); q=(p.get("topicPerformance") or {}).get(topic) or {}
        attempts=int(q.get("attempts") or 0)
        accuracy=max(0,min(1,float(q.get("correct") or 0)/attempts)) if attempts else None
        assessment=1 if accuracy is not None and accuracy>=.7 else (accuracy or 0)
        completion=round((activity*.35+tutorial*.25+assessment*.40)*100)
        topics.append({"topic":topic,"completion":completion,"eligible":activity>0 or tutorial>0 or attempts>0,
                       "accuracy":round(accuracy*100) if accuracy is not None else None,"attempts":attempts})
    eligible=[x for x in topics if x["eligible"]]
    return {"overallCompletion":round(sum(x["completion"] for x in eligible)/len(topics)) if eligible else 0,
            "topics":topics,"activitySignals":len(flags),"quizLevel":max(1,min(5,int(stats.get("quizLevel") or 1)))}

def choose_topic_weights(profile):
    out=[]
    for x in profile["topics"]:
        if x["eligible"]:
            a=x["accuracy"]; out.append({"topic":x["topic"],"weight":1 if a is None else max(.25,1.15-a/100),
                                         "completion":x["completion"],"accuracy":a})
    return sorted(out,key=lambda x:x["weight"],reverse=True)
