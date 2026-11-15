export function mergeRequestProfiles(requests = [], profiles = []) {
  const profileMap = new Map(profiles.map((profile) => [profile.uid, profile]));
  return [...new Map(requests.filter((request) => request?.uid).map((request) => [request.uid, {
    uid: request.uid,
    firstName: `Người dùng ${request.uid.slice(-6)}`,
    lastName: "",
    createdAt: request.createdAt,
    ...profileMap.get(request.uid),
  }])).values()];
}
